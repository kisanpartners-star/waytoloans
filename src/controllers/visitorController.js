const VisitorEvent = require('../models/VisitorEvent');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const detectDevice = (userAgent) => {
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) return 'tablet';
  if (/mobi|iphone|ipod|android/i.test(userAgent)) return 'mobile';
  if (/windows|macintosh|linux|x11/i.test(userAgent)) return 'desktop';
  return 'other';
};

const detectBrowser = (userAgent) => {
  if (/edg\//i.test(userAgent)) return 'Microsoft Edge';
  if (/opr\/|opera/i.test(userAgent)) return 'Opera';
  if (/chrome\//i.test(userAgent) && !/chromium|edg\//i.test(userAgent)) return 'Chrome';
  if (/firefox\//i.test(userAgent)) return 'Firefox';
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return 'Safari';
  return 'Other';
};

const identifierPattern = /^[A-Za-z0-9_-]{8,100}$/;

exports.track = asyncHandler(async (req, res) => {
  const { eventId, visitorId, sessionId, path, pageTitle, type, durationSeconds } = req.body || {};
  if (![eventId, visitorId, sessionId].every((value) => typeof value === 'string' && identifierPattern.test(value))) {
    throw new ApiError(400, 'Visitor tracking identifiers are invalid');
  }
  if (typeof path !== 'string' || !path.startsWith('/') || path.length > 300) {
    throw new ApiError(400, 'Visitor page path is invalid');
  }
  if (type !== 'view' && type !== 'duration') {
    throw new ApiError(400, 'Visitor tracking event type is invalid');
  }

  if (type === 'view') {
    const userAgent = String(req.get('user-agent') || '');
    await VisitorEvent.updateOne(
      { eventId },
      {
        $setOnInsert: {
          eventId,
          visitorId,
          sessionId,
          path,
          pageTitle: typeof pageTitle === 'string' ? pageTitle.slice(0, 160) : '',
          device: detectDevice(userAgent),
          browser: detectBrowser(userAgent),
          visitedAt: new Date(),
          durationSeconds: 0,
        },
      },
      { upsert: true }
    );
  } else {
    const duration = Number(durationSeconds);
    if (!Number.isFinite(duration) || duration < 0 || duration > 86400) {
      throw new ApiError(400, 'Visitor duration is invalid');
    }
    const userAgent = String(req.get('user-agent') || '');
    await VisitorEvent.updateOne(
      { eventId, visitorId, sessionId },
      {
        $max: { durationSeconds: Math.floor(duration) },
        $setOnInsert: {
          eventId,
          visitorId,
          sessionId,
          path,
          pageTitle: typeof pageTitle === 'string' ? pageTitle.slice(0, 160) : '',
          device: detectDevice(userAgent),
          browser: detectBrowser(userAgent),
          visitedAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
  res.status(204).end();
});

exports.analytics = asyncHandler(async (req, res) => {
  const requestedDays = Number(req.query.days || 30);
  const days = [7, 30, 90, 365].includes(requestedDays) ? requestedDays : 30;
  const from = new Date();
  from.setDate(from.getDate() - days);
  const match = { visitedAt: { $gte: from } };

  const [uniqueVisitors, uniqueSessions, pageViews, durationSummary, deviceRows, browserRows, pageRows, dailyRows] = await Promise.all([
    VisitorEvent.distinct('visitorId', match),
    VisitorEvent.distinct('sessionId', match),
    VisitorEvent.countDocuments(match),
    VisitorEvent.aggregate([
      { $match: match },
      { $group: { _id: null, totalSeconds: { $sum: '$durationSeconds' } } },
    ]),
    VisitorEvent.aggregate([
      { $match: match },
      { $group: { _id: '$device', visits: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
      { $sort: { visits: -1 } },
    ]),
    VisitorEvent.aggregate([
      { $match: match },
      { $group: { _id: '$browser', visits: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
      { $sort: { visits: -1 } },
    ]),
    VisitorEvent.aggregate([
      { $match: match },
      { $group: { _id: '$path', views: { $sum: 1 }, seconds: { $sum: '$durationSeconds' }, visitors: { $addToSet: '$visitorId' } } },
      { $project: { path: '$_id', _id: 0, views: 1, visitors: { $size: '$visitors' }, totalSeconds: '$seconds', averageSeconds: { $cond: [{ $gt: ['$views', 0] }, { $divide: ['$seconds', '$views'] }, 0] } } },
      { $sort: { views: -1 } },
      { $limit: 50 },
    ]),
    VisitorEvent.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$visitedAt' } }, visits: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
      { $project: { date: '$_id', _id: 0, visits: 1, uniqueVisitors: { $size: '$visitors' } } },
      { $sort: { date: 1 } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      days,
      totals: {
        totalVisits: uniqueSessions.length,
        uniqueVisitors: uniqueVisitors.length,
        uniqueSessions: uniqueSessions.length,
        pageViews,
        totalTimeSeconds: durationSummary[0]?.totalSeconds || 0,
      },
      devices: deviceRows.map((row) => ({ name: row._id || 'other', visits: row.visits, uniqueVisitors: row.visitors.length })),
      browsers: browserRows.map((row) => ({ name: row._id || 'Other', visits: row.visits, uniqueVisitors: row.visitors.length })),
      pages: pageRows,
      daily: dailyRows,
    },
  });
});

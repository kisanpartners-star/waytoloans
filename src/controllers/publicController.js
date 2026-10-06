const Company = require('../models/Company');
const Setting = require('../models/Setting');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { companyBlockReason } = require('../services/accessService');

const bossBranding = async () => {
  const s = await Setting.findOne({ key: 'boss' });
  return { logoUrl: s?.logoUrl || '', footerLogoUrl: s?.footerLogoUrl || '', logoText: s?.logoText || 'Today Technologies Pvt Ltd', seoTitle: s?.seoTitle || 'Banks Zone', mainHeading: s?.mainHeading || 'Banks Zone' };
};
exports.boss = asyncHandler(async (req, res) => res.json({ success: true, data: await bossBranding() }));
exports.company = asyncHandler(async (req, res) => {
  const c = await Company.findOne({ slug: String(req.params.slug).toLowerCase(), deletedAt: null });
  if (!c || c.status === 'draft') throw new ApiError(404, 'Company panel not found');
  const reason = companyBlockReason(c);
  res.json({ success: true, data: {
    name: c.name, slug: c.slug, brandName: c.brandName || c.name, brandTagline: c.brandTagline || '', logoUrl: c.logoUrl,
    available: !reason, unavailableReason: reason, boss: await bossBranding(),
  } });
});

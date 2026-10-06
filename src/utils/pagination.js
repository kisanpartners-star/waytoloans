module.exports = (q, allowedSort = ['createdAt'], defSort = 'createdAt') => {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit, 10) || 10));
  const sortBy = allowedSort.includes(q.sortBy) ? q.sortBy : defSort;
  const sortDir = q.sortDir === 'asc' ? 1 : -1;
  return { page, limit, skip: (page - 1) * limit, sort: { [sortBy]: sortDir } };
};

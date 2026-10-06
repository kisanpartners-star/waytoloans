// Keeps the auth User and its profile document (Bank/Connector/Dsa/Employee) in sync.
const User = require('../models/User');
const { hashPassword } = require('../utils/password');

async function createAccount({ Profile, user, profile }) {
  const { password, ...u } = user;
  const authUser = await User.create({ ...u, passwordHash: await hashPassword(password) });
  try {
    const doc = await Profile.create({ ...profile, userId: authUser._id, companyId: u.companyId });
    return { user: authUser, profile: doc };
  } catch (e) { await User.deleteOne({ _id: authUser._id }); throw e; }
}
async function updateAccount({ profileDoc, userPatch = {}, password }) {
  const patch = { ...userPatch };
  if (password) { patch.passwordHash = await hashPassword(password); patch.passwordChangedAt = new Date(); patch.refreshTokens = []; }
  if (Object.keys(patch).length) await User.updateOne({ _id: profileDoc.userId }, patch);
}
async function setAccountStatus(profileDoc, status) {
  profileDoc.status = status;
  await profileDoc.save();
  await User.updateOne({ _id: profileDoc.userId }, { status, ...(status !== 'active' ? { refreshTokens: [] } : {}) });
}
async function softDeleteAccount(profileDoc) {
  profileDoc.deletedAt = new Date();
  await profileDoc.save();
  await User.updateOne({ _id: profileDoc.userId }, { deletedAt: new Date(), status: 'disabled', refreshTokens: [] });
}
module.exports = { createAccount, updateAccount, setAccountStatus, softDeleteAccount };

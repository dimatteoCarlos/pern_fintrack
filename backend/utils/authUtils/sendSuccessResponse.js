export const sendSuccessResponse = (
  res,
  statusCode,
  message,
  user,
  accessToken,
  refreshToken
) => {
  const responseData = {
    message,
    user: { ...user },
  };
  if (accessToken) {
    responseData.accessToken = accessToken;
  }
  if (refreshToken) {
    responseData.refreshToken = refreshToken;
  }
  return res.status(statusCode).json(responseData);
};
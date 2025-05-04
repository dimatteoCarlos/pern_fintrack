// src/utils/responseHelpers.ts
import pc from 'picocolors';

export const respondSuccess = (
  res,
  data,
  status = 200,
  message = 'success',
) => {
  console.log(pc.green(`[Success ${status}] ${message}`));
  return res.status(status).json({ status,success:true, message, data });
};
export const respondError = (
  res,
  status = 400,
  message = 'Error',
  errorDetails = null,
  //  errorType: 'validation' | 'business' | 'database' | 'unknown' = 'unknown'
) => {
  console.log(pc.red(`[Error ${status}] ${message}, errorDetails,${errorDetails}`));
  return res.status(status).json({
    status,
    message,
    errorDetails:
      process.env.NODE_ENV === 'development' ? errorDetails : undefined,
  });
};

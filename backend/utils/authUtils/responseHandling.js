//backend/src/utils/authUtils/responseHandling.js

export const handleApiResponse = async (
  response
)=> {
  const data = await response.json();

  if (response.ok) {
    // Response is in the 200-299 range (success)
    const successResponse = {
      message: data.message,
      data: data.data,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
    return successResponse;
  } else {
    // Response is an error (status code 400 or higher)
    const errorResponse= {
      status: response.status,
      message: data.message,
      errors: data.errors, // Use 'errors' instead of 'data' for error details
      timestamp: new Date().toISOString(),
    };
    throw errorResponse; // Throw the error to be caught by useFetch or the interceptor
  }
};
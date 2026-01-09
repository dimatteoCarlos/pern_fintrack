// // backend/src/middleware/authMiddleware/verifyuser.js
// import { pool } from "../db/configDB.js"; // Import necessary for DB query
// import { createError } from "../../utils/errorHandling.js";

// // Assume verifyToken is imported or defined elsewhere
// // import { verifyToken } from './tokenMiddleware.js'; 

// // ======================================
// // 🔑 VERIFY USER AND RESOURCE OWNERSHIP
// // Middleware to check authentication and authorization: 
// // 1. Authenticate (verifyToken)
// // 2. Check if the user is the owner of the targetAccountId OR is an Admin.
// // =======================================
// export const verifyUser = (req, res, next) => {
//     console.log('VERIFYUSER MIDDLEWARE EXECUTED');
    
//     // 1. Execute token verification first
//     verifyToken(req, res, async (error) => { // Must be async here
//         if (error) return next(error);

//         // Check if token verification successfully attached user info
//         if (!req.user || !req.user.userId || !req.user.role) {
//             return next(createError(401, 'User not authenticated or token data missing.'));
//         }

//         const { userId: authenticatedUserId, role: userRole } = req.user;
//         const targetAccountId = req.params.targetAccountId; // 🎯 Correctly extract the Account ID

//         if (!targetAccountId) {
//             // This middleware should only run on routes with this param
//             return next(createError(500, 'Middleware misconfiguration: targetAccountId parameter is missing.'));
//         }

//         try {
//             // 2. RESOURCE OWNERSHIP CHECK: Query the database to find the account owner
//             const ownerQuery = `
//                 SELECT user_id 
//                 FROM user_accounts 
//                 WHERE account_id = $1
//             `;
//             const result = await pool.query(ownerQuery, [targetAccountId]);

//             if (result.rows.length === 0) {
//                 // If the account doesn't exist, we deny access to prevent information leakage
//                 console.log(`Access denied: Target Account ${targetAccountId} not found.`);
//                 return next(createError(404, 'Target account not found.')); 
//             }

//             const ownerId = result.rows[0].user_id;
            
//             console.log(`Authenticated User ID: ${authenticatedUserId}, Account Owner ID: ${ownerId}, Role: ${userRole}`);

//             // 3. AUTHORIZATION LOGIC
//             const isOwner = authenticatedUserId === ownerId;
//             const isAdmin = userRole === 'admin' || userRole === 'super_admin';

//             if (isOwner || isAdmin) {
//                 console.log(`Access granted for ${authenticatedUserId}`);
                
//                 // IMPORTANT: Attach the ownerId to the request for service validation/logging if needed
//                 req.ownerId = ownerId; 
//                 req.authenticatedRole = userRole; // Attach role for easy access in controllers/services

//                 next();
//             } else {
//                 console.log(`Access denied. User ${authenticatedUserId} is not the owner of ${targetAccountId} and is not an admin.`);
//                 return next(createError(403, 'Access not authorized. You do not own this resource.'));
//             }

//         } catch (dbError) {
//             console.error('Database Error during resource ownership check:', dbError);
//             return next(createError(500, 'Internal server error during authorization check.'));
//         }
//     });
// };
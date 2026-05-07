/**
 * Role Guard Middleware
 * Usage: roleGuard("super_admin", "gram_admin")
 * Allows access if user has ANY of the specified roles
 */
const roleGuard = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(", ")}. Your role: ${req.user.role}`,
      });
    }

    next();
  };
};

// Convenience aliases
const isUser = roleGuard("user", "gram_admin", "traffic_admin", "super_admin");
const isGramAdmin = roleGuard("gram_admin", "super_admin");
const isTrafficAdmin = roleGuard("traffic_admin", "super_admin");
const isSuperAdmin = roleGuard("super_admin");

module.exports = { roleGuard, isUser, isGramAdmin, isTrafficAdmin, isSuperAdmin };

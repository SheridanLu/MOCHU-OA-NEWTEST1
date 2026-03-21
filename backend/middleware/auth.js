/**
 * JWT 认证中间件
 * 提供 Token 生成、验证和刷新功能
 * 
 * 支持滑动过期：每次请求自动延长token有效期
 */

const jwt = require('jsonwebtoken');

// 从环境变量获取 JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
// Access Token 有效期（2小时，短期）
const ACCESS_TOKEN_EXPIRES = '2h';
// Refresh Token 有效期（30天，长期）
const REFRESH_TOKEN_EXPIRES = '30d';
// Token 有效期（兼容旧代码）
const TOKEN_EXPIRES_IN = '30d';

/**
 * 生成 Access Token（短期）
 * @param {Object} payload - 用户信息 { userId, username, role }
 * @returns {string} JWT Token
 */
function generateAccessToken(payload) {
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

/**
 * 生成 Refresh Token（长期）
 * @param {Object} payload - 用户信息 { userId, username }
 * @returns {string} JWT Token
 */
function generateRefreshToken(payload) {
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
}

/**
 * 生成 JWT Token（兼容旧代码）
 * @param {Object} payload - 用户信息 { userId, username, role }
 * @returns {string} JWT Token
 */
function generateToken(payload) {
  return jwt.sign(
    {
      userId: payload.userId || payload.id,
      username: payload.username,
      role: payload.role
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

/**
 * 验证 JWT Token
 * @param {string} token - JWT Token
 * @returns {Object|null} 解码后的用户信息，验证失败返回 null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * JWT 认证中间件
 * 从 Authorization header 获取 token，验证并挂载用户信息到 req.user
 * 
 * 支持滑动过期：每次请求自动延长token有效期
 */
function authMiddleware(req, res, next) {
  // 从 header 获取 Authorization
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌，请先登录'
    });
  }

  // 检查 Bearer 格式
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: '令牌格式错误，请使用 Bearer <token> 格式'
    });
  }

  const token = parts[1];

  // 验证 token
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: '令牌无效或已过期，请重新登录'
    });
  }

  // 将用户信息挂载到 req.user（兼容 id 和 userId）
  req.user = {
    id: decoded.userId || decoded.id,
    userId: decoded.userId || decoded.id,
    username: decoded.username,
    role: decoded.role
  };

  // 滑动过期：如果token即将过期（剩余时间<1小时），自动刷新
  try {
    const decodedExp = jwt.decode(token);
    if (decodedExp && decodedExp.exp) {
      const expiresAt = decodedExp.exp * 1000; // 转换为毫秒
      const now = Date.now();
      const remainingTime = expiresAt - now;
      const oneHour = 60 * 60 * 1000;
      
      // 如果剩余时间小于1小时，自动刷新token
      if (remainingTime < oneHour && remainingTime > 0) {
        const newToken = generateToken({
          userId: req.user.userId,
          username: req.user.username,
          role: req.user.role
        });
        // 在响应头中返回新token
        res.setHeader('X-New-Token', newToken);
      }
    }
  } catch (e) {
    // 刷新失败不影响正常请求
    console.error('自动刷新token失败:', e.message);
  }

  next();
}

/**
 * 可选认证中间件
 * 如果提供了 token 则验证，没有提供也继续执行（用于某些可选认证的场景）
 */
function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    req.user = null;
    return next();
  }

  const token = parts[1];
  const decoded = verifyToken(token);
  
  if (decoded) {
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role
    };
  } else {
    req.user = null;
  }

  next();
}

/**
 * 角色权限检查中间件
 * @param {string[]} allowedRoles - 允许访问的角色列表
 */
function checkRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证，请先登录'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足，无法访问此资源'
      });
    }

    next();
  };
}

module.exports = {
  generateToken,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  authMiddleware,
  optionalAuthMiddleware,
  checkRole,
  JWT_SECRET,
  ACCESS_TOKEN_EXPIRES,
  REFRESH_TOKEN_EXPIRES,
  TOKEN_EXPIRES_IN
};

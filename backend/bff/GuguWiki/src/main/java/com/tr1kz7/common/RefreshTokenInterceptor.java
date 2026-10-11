package com.tr1kz7.common;

import com.tr1kz7.DTO.UserDTO;
import com.tr1kz7.mapper.AuthMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * 可选恢复登录态；未带 Token 的公开请求仍放行。
 * */
public class RefreshTokenInterceptor implements HandlerInterceptor {
    private final StringRedisTemplate redis;
    private final AuthMapper authMapper;

    public RefreshTokenInterceptor(StringRedisTemplate redis, AuthMapper authMapper) {
        this.redis = redis;
        this.authMapper = authMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        //拿到请求头中的token
        String token = request.getHeader("Authorization");
        //检查token符不符合约定
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}"))
            return true;
        //拿到redis中的登陆凭证
        String key = RedisConstants.LOGIN_TOKEN + token;
        String userId = redis.opsForValue().get(key);
        //为登录用户放行
        if (userId == null)
            return true;
        //拿到登陆用户信息
        try {
            UserDTO user = authMapper.findEnabledById(UUID.fromString(userId));
            if (user == null) {
                redis.delete(key);
                return true;
            }
            //ThreadLocal保存当前用户信息
            UserHolder.saveUser(user);
            //用户凭证续期
            redis.expire(key, RedisConstants.LOGIN_TOKEN_TTL, TimeUnit.MINUTES);
        } catch (IllegalArgumentException invalidId) {
            redis.delete(key);
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception exception) {
        UserHolder.removeUser();
    }
}

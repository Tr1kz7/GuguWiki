package com.tr1kz7.service.Impl;

import com.tr1kz7.DTO.Result;
import com.tr1kz7.DTO.UserDTO;
import com.tr1kz7.common.RedisConstants;
import com.tr1kz7.common.UserHolder;
import com.tr1kz7.entity.LoginAccount;
import com.tr1kz7.entity.User;
import com.tr1kz7.mapper.AuthMapper;
import com.tr1kz7.service.AuthService;
import com.tr1kz7.service.PasswordService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.concurrent.TimeUnit;

/** 登录校验与 Redis 登录态。 */
@Service
public class AuthServiceImpl implements AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Autowired
    private AuthMapper authMapper;
    @Autowired
    private StringRedisTemplate stringRedisTemplate;
    @Autowired
    private PasswordService passwordService;

    @Override
    public ResponseEntity<Result> login(User user) {
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()
                || user.getPassword() == null || user.getPassword().isBlank()
                || (!"READER".equals(user.getEntry()) && !"ADMIN".equals(user.getEntry()))) {
            return ResponseEntity.badRequest().body(Result.fail(400, "请填写邮箱、密码和有效的登录入口。"));
        }

        LoginAccount account = authMapper.findByEmail(user.getEmail().trim());
        if (account == null || !account.isEnabled()
                || !passwordService.matches(user.getPassword(), account.getPasswordHash())) {
            return ResponseEntity.status(401).body(Result.fail(401, "账号或密码不正确。"));
        }
        if ("ADMIN".equals(user.getEntry()) && !"ADMIN".equals(account.getRole())) {
            return ResponseEntity.status(403).body(Result.fail(403, "此账号没有管理员权限。"));
        }

        UserDTO userDTO = new UserDTO(account.getId(), account.getName(), account.getEmail(), account.getRole());
        byte[] random = new byte[32];
        SECURE_RANDOM.nextBytes(random);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        stringRedisTemplate.opsForValue().set(RedisConstants.LOGIN_TOKEN + token,
                userDTO.getId().toString(), RedisConstants.LOGIN_TOKEN_TTL, TimeUnit.MINUTES);
        return ResponseEntity.ok(Result.success(200, userDTO, "欢迎登录，" + userDTO.getName() + "！", token));
    }

    @Override
    public ResponseEntity<Result> me() {
        return ResponseEntity.ok(Result.success(200, UserHolder.getUser(), "", null));
    }

    @Override
    public ResponseEntity<Void> logout(String token) {
        stringRedisTemplate.delete(RedisConstants.LOGIN_TOKEN + token);
        return ResponseEntity.noContent().build();
    }
}

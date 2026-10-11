package com.tr1kz7.service;

import at.favre.lib.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

/**
 * 账号创建和登录共用同一种密码算法。
 * */
@Service
public class PasswordService {

    public String hash(String password) {
        return BCrypt.withDefaults().hashToString(12, password.toCharArray());
    }

    public boolean matches(String password, String storedHash) {
        if (storedHash == null || !storedHash.startsWith("$2")) return false;
        try {
            return BCrypt.verifyer().verify(password.toCharArray(), storedHash).verified;
        } catch (IllegalArgumentException invalidHash) {
            return false;
        }
    }
}

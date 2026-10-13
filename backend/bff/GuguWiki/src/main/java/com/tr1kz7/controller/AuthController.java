package com.tr1kz7.controller;

import com.tr1kz7.DTO.Result;
import com.tr1kz7.entity.User;
import com.tr1kz7.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 处理登录、当前用户信息查询和退出登录请求
 * */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    @Autowired
    private AuthService authService;

    /**
     * 校验密码并创建 Redis 登录态。
     * */
    @PostMapping("/login")
    public ResponseEntity<Result> login(@RequestBody User user){
        return authService.login(user);
    }

    /**
    * 刷新页面重载用户信息
    * */
    @GetMapping("/me")
    public ResponseEntity<Result> me() {
        return authService.me();
    }

    /**
     * 登出
     */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader("Authorization") String token) {
        return authService.logout(token);
    }

}

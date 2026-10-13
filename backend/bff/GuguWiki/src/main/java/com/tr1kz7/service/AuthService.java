package com.tr1kz7.service;


import com.tr1kz7.DTO.Result;
import com.tr1kz7.entity.User;
import org.springframework.http.ResponseEntity;


/**
 * 用户登录等操作
 * */
public interface AuthService {
    //登录功能
    ResponseEntity<Result> login(User user);
    //刷新页面重载用户信息
    ResponseEntity<Result> me();
    //登出功能
    ResponseEntity<Void> logout(String token);
}

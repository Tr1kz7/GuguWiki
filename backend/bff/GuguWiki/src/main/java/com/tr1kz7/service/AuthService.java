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
    ResponseEntity<Result> me();
    ResponseEntity<Void> logout(String token);
}

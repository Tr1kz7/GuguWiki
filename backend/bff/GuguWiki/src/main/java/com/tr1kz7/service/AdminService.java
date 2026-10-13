package com.tr1kz7.service;

import com.tr1kz7.DTO.Result;
import com.tr1kz7.DTO.UserDTO;
import com.tr1kz7.entity.NewUser;
import org.springframework.http.ResponseEntity;

/**
 * 管理员管理用户
 * */
public interface AdminService {
    //管理员创建用户
    ResponseEntity<Result> createUser(NewUser newUser);
    //列出所有用户
    ResponseEntity<Result> getAllUsers();
}

package com.tr1kz7.service.Impl;

import com.tr1kz7.DTO.Result;
import com.tr1kz7.DTO.UserDTO;
import com.tr1kz7.entity.NewUser;
import com.tr1kz7.mapper.AdminMapper;
import com.tr1kz7.service.AdminService;
import com.tr1kz7.service.PasswordService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class AdminServiceImpl implements AdminService {

    @Autowired
    private AdminMapper adminMapper;
    @Autowired
    private PasswordService passwordService;

    @Override
    public ResponseEntity<Result> createUser(NewUser newUser){
        if(newUser.getInitialPassword().length() < 8){
            return ResponseEntity.status(400).body(Result.fail(400,"请输入至少8位长度密码"));
        }
        String existUserName = adminMapper.findUserByEmail(newUser.getEmail());
        if(existUserName != null){
            return ResponseEntity.status(409).body(Result.fail(409,"已存在同邮箱用户："+ existUserName));
        }

        UserDTO userDTO = new UserDTO();
        userDTO.setName(newUser.getName());
        userDTO.setEmail(newUser.getEmail());
        userDTO.setRole(newUser.getRole());
        //数据库添加用户
        adminMapper.createUser(newUser.getEmail(),
                newUser.getName(),
                passwordService.hash(newUser.getInitialPassword()),
                newUser.getRole());
        UUID id = adminMapper.getUserId(newUser.getEmail());
        userDTO.setId(id);
        return ResponseEntity.status(200).body(Result.success(200, userDTO, "新用户创建成功"));
    }

    @Override
    public ResponseEntity<Result> getAllUsers() {
        List<UserDTO> userDTO = adminMapper.getAllUsers();
        return ResponseEntity.status(200).body(Result.success(200, userDTO.toArray()));
    }
}

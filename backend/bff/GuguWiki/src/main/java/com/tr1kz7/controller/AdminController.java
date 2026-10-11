package com.tr1kz7.controller;


import com.tr1kz7.DTO.Result;
import com.tr1kz7.common.RequireRole;
import com.tr1kz7.entity.NewUser;
import com.tr1kz7.service.AdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 *  管理员创建、查看用户
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequireRole("ADMIN")
public class AdminController {

    @Autowired
    private AdminService adminService;

    /**
     * 创建用户
     * @param newUser 前端传入的新用户信息
     * @return 将注册好的用户信息给前端
     */
    @PostMapping("/users")
    public ResponseEntity<Result> createUser(@RequestBody NewUser newUser){
        return adminService.createUser(newUser);
    }

    /**
     * 查询所有用户
     * @return 返回查询的用户列表给前端
     */
    @GetMapping("/users")
    public ResponseEntity<Result> getAllUsers(){
        return adminService.getAllUsers();
    }
}

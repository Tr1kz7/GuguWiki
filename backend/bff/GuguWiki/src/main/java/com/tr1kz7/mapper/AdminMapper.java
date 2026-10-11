package com.tr1kz7.mapper;


import com.tr1kz7.DTO.UserDTO;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.UUID;

@Mapper
public interface AdminMapper {

    /**
     * 根据新用户的邮箱查询是否存在用户名
     */
    @Select("select display_name as name from users where lower(email) = lower(#{email})")
    String findUserByEmail(String email);

    /**
     * 创建新用户
     */
    @Insert("insert into users (email, display_name, password_hash, role) values (#{email},#{display_name},#{password_hash},#{role})")
    void createUser(String email, String display_name, String password_hash, String role);

    /**
     * 查询用户id
     */
    @Select("select id from users where lower(email) = lower(#{email})")
    UUID getUserId(String email);

    /**
     * 查询所有用户
     */
    @Select("select id, display_name as name, email, role from users order by created_at desc, id desc")
    List<UserDTO> getAllUsers();
}

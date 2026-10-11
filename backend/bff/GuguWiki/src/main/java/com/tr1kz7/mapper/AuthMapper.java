package com.tr1kz7.mapper;

import com.tr1kz7.DTO.UserDTO;
import com.tr1kz7.entity.LoginAccount;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;



/**
 * 处理用户登录相关的数据库操作
 * */
@Mapper
public interface AuthMapper {

    /**
     * 根据邮箱查询登录用户信息
     * */
    @Select("select id, display_name as name, email, role, password_hash, enabled from users where lower(email) = lower(#{email})")
    LoginAccount findByEmail(@Param("email") String email);

    @Select("select id, display_name as name, email, role from users where id = #{id} and enabled = true")
    UserDTO findEnabledById(@Param("id") java.util.UUID id);

}

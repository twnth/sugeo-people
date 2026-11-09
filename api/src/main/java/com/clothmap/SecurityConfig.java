package com.clothmap;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
@Configuration
public class SecurityConfig {
  @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
  @Bean ApplicationRunner adminBootstrap(JdbcTemplate jdbc, PasswordEncoder encoder,
      @Value("${app.admin-username}") String username,@Value("${app.admin-password}") String password) {
    return args -> {
      if (!username.isBlank() && !password.isBlank()) {
        Integer count=jdbc.queryForObject("select count(*) from admin_users where username=?",Integer.class,username);
        if (count==0) jdbc.update("insert into admin_users(id,username,password_hash) values (?,?,?)",UUID.randomUUID(),username,encoder.encode(password));
      }
    };
  }
  @Bean UserDetailsService users(JdbcTemplate jdbc) {
    return name -> jdbc.query("select username,password_hash from admin_users where username=?",rs -> {
      if (!rs.next()) throw new org.springframework.security.core.userdetails.UsernameNotFoundException(name);
      return User.withUsername(rs.getString(1)).password(rs.getString(2)).roles("ADMIN").build();
    },name);
  }
  @Bean SecurityFilterChain security(HttpSecurity http) throws Exception {
    return http.csrf(csrf -> csrf.disable()).cors(Customizer.withDefaults())
      .authorizeHttpRequests(a -> a.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
      .requestMatchers(HttpMethod.GET,"/api/v1/boxes/**").permitAll()
      .requestMatchers("/api/v1/reports","/api/v1/boxes/*/confirmations","/api/v1/boxes/*/observations").permitAll()
      .anyRequest().denyAll())
      .httpBasic(basic -> basic.authenticationEntryPoint((request,response,error) -> {
        response.setStatus(401);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":\"UNAUTHORIZED\",\"message\":\"관리자 인증이 필요합니다.\"}");
      }))
      .exceptionHandling(errors -> errors.accessDeniedHandler((request,response,error) -> {
        response.setStatus(403);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":\"FORBIDDEN\",\"message\":\"접근 권한이 없습니다.\"}");
      }))
      .sessionManagement(s -> s.sessionCreationPolicy(org.springframework.security.config.http.SessionCreationPolicy.STATELESS))
      .build();
  }
  @Bean CorsConfigurationSource cors(@Value("${app.web-origin}") String origin) {
    CorsConfiguration config=new CorsConfiguration();
    config.setAllowedOrigins(List.of(origin)); config.setAllowedMethods(List.of("GET","POST","PATCH","OPTIONS"));
    config.setAllowedHeaders(List.of("Authorization","Content-Type")); config.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source=new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**",config); return source;
  }
}

package com.clothmap;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
@Component
public class AnonymousIdentity {
  private final String secret; private final SecureRandom random=new SecureRandom();
  AnonymousIdentity(@Value("${app.anonymous-secret}") String secret) { this.secret=secret; }
  private String sign(String value) {
    try { Mac mac=Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    } catch(Exception e) { throw new IllegalStateException("익명 토큰 설정 오류"); }
  }
  String hash(HttpServletRequest request,HttpServletResponse response) {
    if(secret.length()<32) throw new IllegalStateException("ANON_SIGNING_SECRET을 32자 이상으로 설정해주세요.");
    String value=null;
    if(request.getCookies()!=null) for(Cookie cookie:request.getCookies()) if(cookie.getName().equals("cloth_anon")) {
      String[] parts=cookie.getValue().split("\\.");
      if(parts.length==2&&MessageDigest.isEqual(sign(parts[0]).getBytes(StandardCharsets.UTF_8),parts[1].getBytes(StandardCharsets.UTF_8))) value=parts[0];
    }
    if(value==null) { byte[] bytes=new byte[32]; random.nextBytes(bytes); value=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
      response.addHeader("Set-Cookie",ResponseCookie.from("cloth_anon",value+"."+sign(value)).httpOnly(true).secure(request.isSecure()).sameSite("Lax").path("/").maxAge(60L*60*24*365).build().toString()); }
    return sign("reporter:"+value);
  }
}

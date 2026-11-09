package com.clothmap;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
class BoxControllerTest {
  @Test void rejectsInvalidCoordinates() {
    assertThrows(IllegalArgumentException.class,()->BoxController.coordinates(91,127));
    assertThrows(IllegalArgumentException.class,()->BoxController.coordinates(37,181));
    assertThrows(IllegalArgumentException.class,()->BoxController.coordinates(Double.NaN,127));
  }
  @Test void rejectsOversizedBoundsBeforeDatabaseQuery() {
    JdbcTemplate jdbc=mock(JdbcTemplate.class); BoxController controller=new BoxController(jdbc);
    assertThrows(IllegalArgumentException.class,()->controller.bounds(34,126,38,128,null));
    verifyNoInteractions(jdbc);
  }
  @Test void rejectsExcessiveNearbyRadius() {
    JdbcTemplate jdbc=mock(JdbcTemplate.class); BoxController controller=new BoxController(jdbc);
    assertThrows(IllegalArgumentException.class,()->controller.nearby(37.5,127,5001,10,null));
    verifyNoInteractions(jdbc);
  }
  @Test void rejectsInvalidSourceBeforeDatabaseQuery() {
    JdbcTemplate jdbc=mock(JdbcTemplate.class); BoxController controller=new BoxController(jdbc);
    assertThrows(IllegalArgumentException.class,()->controller.bounds(37.5,126.9,37.6,127.1,"OTHER"));
    assertThrows(IllegalArgumentException.class,()->controller.nearby(37.5,127,1000,10,"OTHER"));
    verifyNoInteractions(jdbc);
  }
}

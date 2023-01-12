package socialnetwork.pageobjects;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class PO_PrivateView extends PO_NavView {


    public static void goToUsersList(WebDriver driver) {
        driver.findElement(By.id("dropdownUsers")).click();
        driver.findElement(By.id("listUsersOption")).click();
    }

    public static void goToFriendsList(WebDriver driver) {
        driver.findElement(By.id("dropdownFriends")).click();
        driver.findElement(By.id("listFriendsOption")).click();
    }

    public static void goToRequestsList(WebDriver driver) {
        driver.findElement(By.id("dropdownFriendRequests")).click();
        driver.findElement(By.id("listRequestsOption")).click();
    }

}

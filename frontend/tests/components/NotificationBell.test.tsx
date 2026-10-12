import { render, screen } from "@testing-library/react";
import { NotificationBell } from "@/components/NotificationBell";

describe("NotificationBell", () => {
  it("renders bell icon", () => {
    render(<NotificationBell unreadCount={0} />);
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
  });

  it("shows unread count badge when unreadCount > 0", () => {
    render(<NotificationBell unreadCount={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("hides badge when unreadCount is 0", () => {
    render(<NotificationBell unreadCount={0} />);
    expect(screen.queryByTestId("unread-badge")).not.toBeInTheDocument();
  });

  it("caps badge display at 99+", () => {
    render(<NotificationBell unreadCount={150} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});

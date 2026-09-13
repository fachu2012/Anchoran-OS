import { beforeEach, describe, expect, it } from "vitest";
import { useNotificationStore } from "./notificationStore";

function resetStore() {
  useNotificationStore.setState({ notifications: [], doNotDisturb: false });
}

describe("notificationStore", () => {
  beforeEach(resetStore);

  it("pushes a new, unread notification to the front of the list", () => {
    useNotificationStore.getState().push("Files", "First");
    useNotificationStore.getState().push("Files", "Second");
    const { notifications } = useNotificationStore.getState();
    expect(notifications).toHaveLength(2);
    expect(notifications[0].message).toBe("Second");
    expect(notifications[0].read).toBe(false);
  });

  it("marks a notification silent when pushed during Do Not Disturb", () => {
    useNotificationStore.getState().setDoNotDisturb(true);
    useNotificationStore.getState().push("Files", "Quiet one");
    expect(useNotificationStore.getState().notifications[0].silent).toBe(true);
  });

  it("dismiss removes exactly the targeted notification", () => {
    useNotificationStore.getState().push("Files", "Keep");
    useNotificationStore.getState().push("Files", "Remove");
    const toRemove = useNotificationStore.getState().notifications[0];
    useNotificationStore.getState().dismiss(toRemove.id);
    const remaining = useNotificationStore.getState().notifications;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].message).toBe("Keep");
  });

  it("markAllRead flips every current notification to read, without affecting later ones", () => {
    useNotificationStore.getState().push("Files", "One");
    useNotificationStore.getState().markAllRead();
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);

    useNotificationStore.getState().push("Files", "Two");
    const [newest, oldest] = useNotificationStore.getState().notifications;
    expect(newest.read).toBe(false);
    expect(oldest.read).toBe(true);
  });

  it("clearAll empties the list", () => {
    useNotificationStore.getState().push("Files", "One");
    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("carries an optional action through to the stored notification", () => {
    const onClick = () => {};
    useNotificationStore.getState().push("Files", "Has an action", { label: "Undo", onClick });
    expect(useNotificationStore.getState().notifications[0].action).toEqual({ label: "Undo", onClick });
  });
});

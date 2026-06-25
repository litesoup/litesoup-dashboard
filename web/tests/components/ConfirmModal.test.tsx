import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmModal } from "@/components/ConfirmModal";

describe("ConfirmModal", () => {
  it("calls onConfirm when confirm button clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        open={true}
        onOpenChange={() => {}}
        title="Delete site?"
        description="This cannot be undone."
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onOpenChange(false) when cancel clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmModal
        open={true}
        onOpenChange={onOpenChange}
        title="Delete site?"
        description="This cannot be undone."
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

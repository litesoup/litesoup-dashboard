import { render, screen } from "@testing-library/react";
import { OutputDrawer } from "@/components/OutputDrawer";

describe("OutputDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <OutputDrawer
        open={false}
        onOpenChange={() => {}}
        title="Create site"
        lines={[]}
        exitCode={null}
      />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renders output lines when open", () => {
    render(
      <OutputDrawer
        open={true}
        onOpenChange={() => {}}
        title="Create site"
        lines={["[INFO] creating site", "[INFO] done"]}
        exitCode={null}
      />,
    );
    expect(screen.getByText("[INFO] creating site")).toBeInTheDocument();
    expect(screen.getByText("[INFO] done")).toBeInTheDocument();
  });

  it("shows success badge when exit code is 0", () => {
    render(
      <OutputDrawer
        open={true}
        onOpenChange={() => {}}
        title="Create site"
        lines={["done"]}
        exitCode={0}
      />,
    );
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });

  it("shows failure badge when exit code is non-zero", () => {
    render(
      <OutputDrawer
        open={true}
        onOpenChange={() => {}}
        title="Create site"
        lines={["error"]}
        exitCode={1}
      />,
    );
    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });
});

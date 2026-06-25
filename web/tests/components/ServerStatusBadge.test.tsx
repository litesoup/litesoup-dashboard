import { render, screen } from "@testing-library/react";
import { ServerStatusBadge } from "@/components/ServerStatusBadge";

describe("ServerStatusBadge", () => {
  it("renders active status", () => {
    render(<ServerStatusBadge status="active" />);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders offline status", () => {
    render(<ServerStatusBadge status="offline" />);
    expect(screen.getByText("offline")).toBeInTheDocument();
  });

  it("renders unknown status", () => {
    render(<ServerStatusBadge status="unknown" />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});

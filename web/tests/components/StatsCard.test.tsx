import { render, screen } from "@testing-library/react";
import { Server } from "lucide-react";
import { StatsCard } from "@/components/StatsCard";

describe("StatsCard", () => {
  it("renders label and value", () => {
    render(<StatsCard label="Total Servers" value={5} />);
    expect(screen.getByText("Total Servers")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(<StatsCard label="Servers" value={3} icon={Server} />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });
});

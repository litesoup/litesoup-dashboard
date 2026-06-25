import { render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/DataTable";

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
];

describe("DataTable", () => {
  it("renders rows", () => {
    render(<DataTable columns={columns} data={[{ id: "1", name: "sg9" }]} />);
    expect(screen.getByText("sg9")).toBeInTheDocument();
  });

  it("renders empty message when no data", () => {
    render(
      <DataTable columns={columns} data={[]} emptyMessage="Nothing here." />,
    );
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("renders default empty message", () => {
    render(<DataTable columns={columns} data={[]} />);
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });
});

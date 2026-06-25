import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as api from "@/lib/api";
import Login from "@/pages/Login";
import { AuthProvider } from "@/lib/auth";

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Login", () => {
  it("renders email and password fields", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it("calls login and succeeds on valid credentials", async () => {
    vi.spyOn(api, "login").mockResolvedValueOnce(undefined);
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith("admin@example.com", "secret");
    });
  });

  it("shows error message on failed login", async () => {
    vi.spyOn(api, "login").mockRejectedValueOnce(
      new Error("invalid credentials"),
    );
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "invalid credentials",
      );
    });
  });
});

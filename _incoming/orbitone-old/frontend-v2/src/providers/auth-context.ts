import { createContext } from "react";
import type { AuthContextValue } from "./AuthProvider";

export const AuthContext = createContext<AuthContextValue | null>(null);

import { useContext } from "react";
import ProfileContext from "./ProfileContext";

export function useProfile() {
  return useContext(ProfileContext);
}

import React from "react";

const ProfileContext = React.createContext({
  profile: null,
  loading: true,
  loadError: "",
  createProfile: async () => null,
  saveProfile: async () => null,
  checkUsernameAvailability: async () => ({ available: false, normalized: "", reason: "" }),
  refreshProfile: async () => null,
});

export default ProfileContext;

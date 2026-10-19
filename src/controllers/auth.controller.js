import * as authService from '../services/auth.service.js';

// Errors (duplicate email → 409, bad credentials → 401, anything else → 500)
// propagate to the centralized error middleware.
export const register = async (req, res) => {
  const { name, email, password } = req.body;
  const newUser = await authService.registerUser(name, email, password);
  res.status(201).json(newUser);
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const { token, user } = await authService.loginUser(email, password);

  res.status(200).json({
    message: "Login successful",
    token,
    user
  });
};

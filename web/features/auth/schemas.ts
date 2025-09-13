import { z } from "zod";
import { zfd } from "zod-form-data";
import { loginUser } from "./actions";

export const emailAuthSchema = zfd.formData({
  email: zfd.text(
    z
      .string()
      .email()
      .min(3, { message: "Email must be at least 3 characters" })
      .max(255, { message: "Email must be less than 255 characters" })
  ),
  password: zfd.text(
    z
      .string()
      .min(6, { message: "Password must be at least 6 characters" })
      .max(100, { message: "Password must be less than 100 characters" })
  ),
});

export type EmailAuthSchemaType = z.infer<typeof emailAuthSchema>;

export type EmailAuthAction = typeof loginUser;

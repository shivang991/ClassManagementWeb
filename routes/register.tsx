import { Handlers, PageProps } from "$fresh/server.ts";
import { z, ZodError } from "$zod";
import { createUser, doesUserExistByEmail } from "../db/models/user.ts";
import Button from "../islands/form/Button.tsx";
import TextField from "../islands/form/TextField.tsx";
import UserTypeInput from "../islands/routes/register/UserTypeInput.tsx";
import { login } from "../utils/auth.ts";
import { getUserFromReq } from "../utils/auth.ts";

const registerSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(4).max(16),
  password_confirm: z.string().min(4).max(16),
  type: z.enum(["STAFF", "STUDENT"]),
});

type RegisterField = keyof z.infer<typeof registerSchema>;

export const handler: Handlers = {
  // redirect away the authenticated users
  async GET(req, ctx) {
    if (await getUserFromReq(req)) {
      return new Response(null, {
        status: 307,
        headers: { Location: "/app/dashboard" },
      });
    }
    return ctx.render();
  },

  async POST(req, ctx) {
    const formData = Object.fromEntries((await req.formData()).entries());
    try {
      const data = registerSchema.parse(formData);

      // custom validations
      const errors = new Set<RegisterField>();

      if (data.password !== data.password_confirm) {
        errors.add("password_confirm");
      }
      if (await doesUserExistByEmail(data.email)) {
        errors.add("email");
      }
      if (errors.size) {
        return ctx.render({
          errors,
          data: { ...data, password: "", password_confirm: "" },
        });
      }

      const user = await createUser(data);

      return new Response(null, {
        status: 303,
        headers: await login(user, new URL(req.url)),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return ctx.render({
          errors: new Set<RegisterField>(
            error.issues.map(({ path }) => path[0] as RegisterField),
          ),
        });
      }
      throw error;
    }
  },
};

export default function Register(
  props: PageProps<
    {
      errors?: Set<RegisterField>;
      data?: z.infer<typeof registerSchema>;
    }
  >,
) {
  return (
    <main class="max-w-lg mx-auto mt-4">
      <img src="/logo.svg" width={64} />
      <h2 class="text-4xl font-bold mb-8">Register a new user account</h2>
      <form method="POST">
        <div className="space-y-2">
          <UserTypeInput default={props.data?.data?.type ?? "STUDENT"} />

          <TextField
            value={props.data?.data?.name}
            label="Username"
            name="name"
            autoComplete="none"
            required
          />
          <TextField
            value={props.data?.data?.email}
            type="email"
            label="Email"
            name="email"
            required
            error={props.data?.errors?.has("email")
              ? "Email already exists!"
              : null}
          />
          <TextField
            value={props.data?.data?.password}
            label="Password"
            type="password"
            name="password"
            minLength={4}
            maxLength={16}
            required
          />
          <TextField
            value={props.data?.data?.password_confirm}
            label="Confirm Password"
            type="password"
            name="password_confirm"
            minLength={4}
            maxLength={16}
            required
            error={props.data?.errors?.has("password_confirm")
              ? "Invalid password confirmation"
              : null}
          />
        </div>
        <Button class="mt-8">
          Register
        </Button>
      </form>
    </main>
  );
}

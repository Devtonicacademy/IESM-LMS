import { redirect } from "next/navigation";

export default function Home() {
  redirect("/iesm/auth/signup");
}

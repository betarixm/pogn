import { permanentRedirect } from "next/navigation";

const Page = (): never => {
  permanentRedirect("/posts");
};

export default Page;

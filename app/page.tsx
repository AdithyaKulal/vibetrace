import { Button } from "@/components/ui/button";
import SignInFormClient from "@/modules/auth/components/sign-in-form-client";
import UserButton from "@/modules/auth/components/user-button";
import Image from "next/image";
import React from "react";

const Page = () => {
  return (
    <div className="flex flex-col
    items-center justify-center h-screen bg-gray-100">
      <Button>get started</Button>
      <UserButton />
    </div>
  );
};

export default Page;

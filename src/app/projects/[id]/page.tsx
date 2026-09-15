import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectHub } from "@/components/projects/ProjectHub";
import { PROJECTS, projectById } from "@/mock/projects";

export const dynamicParams = false;

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: projectById(id)?.name ?? "Project" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!projectById(id)) notFound();
  return <ProjectHub id={id} />;
}

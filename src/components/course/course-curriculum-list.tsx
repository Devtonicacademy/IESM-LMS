"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BookOpen, CheckCircle, Circle, PlayCircle, FileText, File, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

interface CourseCurriculumListProps {
  course: any;
  schoolSlug: string;
  courseId: string;
  user: any;
  isEnrolled: boolean;
  onToggleModuleCompletion?: (index: number, isCompleted: boolean) => void;
  isSidebar?: boolean;
  activeItemType?: "module" | "quiz" | "case_study" | "final_assessment";
  activeIndex?: number;
}

export default function CourseCurriculumList({
  course,
  schoolSlug,
  courseId,
  user,
  isEnrolled,
  onToggleModuleCompletion,
  isSidebar = false,
  activeItemType,
  activeIndex,
}: CourseCurriculumListProps) {
  if (!course) return null;

  if (course.courseType === "pdf_only") {
    if (isSidebar) return null; // No sidebar nav for single PDF course
    return (
      <div className="space-y-4">
        <Card className="overflow-hidden transition-all duration-300 hover:shadow-md border-primary/30">
          <CardHeader className="py-4">
            <CardTitle className="text-base font-semibold flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-background border border-border/50 shadow-sm transition-colors">
                <File className="h-4 w-4 text-red-500" />
              </div>
              Course Document (PDF)
            </CardTitle>
          </CardHeader>
          {isEnrolled && course.pdfUrl && (
            <CardContent className="pt-0 pb-5 px-6 border-t border-border/5 text-sm">
              <div className="mt-4 flex items-center justify-between">
                <div className="text-muted-foreground">
                  View or download the full course material.
                </div>
                <a href={course.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 gap-2">
                  <FileText className="h-4 w-4" /> Open PDF
                </a>
              </div>
            </CardContent>
          )}
          {!isEnrolled && (
            <CardContent className="pt-0 pb-5 px-6 border-t border-border/5 text-sm">
              <div className="mt-4 text-muted-foreground text-center">
                Enroll in the course to access the document.
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  if (course.sections && course.sections.length > 0) {
    return (
      <div className={cn(isSidebar ? "space-y-4" : "space-y-10")}>
        {course.sections.map((section: any, sIdx: number) => {
          return (
            <div key={sIdx} className={cn(isSidebar ? "space-y-2" : "space-y-4")}>
              {isSidebar ? (
                <div className="flex items-center gap-2 px-1 mb-1">
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{section.title}</div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">
                    {sIdx + 1}
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">{section.title}</h3>
                </div>
              )}

              <div className={cn("grid", isSidebar ? "gap-1" : "gap-4")}>
                {section.modules?.map((mod: any, mIdx: number) => {
                  const previousModulesCount = course.sections
                    .slice(0, sIdx)
                    .reduce((acc: number, s: any) => acc + (s.modules?.length || 0), 0);
                  const finalIndex = previousModulesCount + mIdx;
                  const isCompleted = user && mod.completedBy?.includes(user.uid);
                  const isActive = activeItemType === "module" && activeIndex === finalIndex;

                  if (isSidebar) {
                    return (
                      <Link key={mIdx} href={`/${schoolSlug}/courses/${courseId}/modules/${finalIndex}`}>
                        <div className={cn(
                          "p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 group border border-transparent",
                          isActive ? "bg-background border-border shadow-sm" : "hover:bg-background/50",
                          !isActive && isCompleted && "opacity-70"
                        )}>
                          <div className={cn(
                            "shrink-0 p-1.5 rounded-lg border shadow-xs transition-colors",
                            isActive ? "bg-primary text-primary-foreground border-primary" : "bg-background group-hover:border-primary/30 group-hover:text-primary"
                          )}>
                            {mod.type === "video" ? <PlayCircle className="h-3.5 w-3.5" /> : mod.type === "pdf" ? <File className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-xs font-bold truncate transition-colors",
                              isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                            )}>
                              {mod.title}
                            </p>
                          </div>
                          {isCompleted && (
                            <CheckCircle className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              isActive ? "text-primary" : "text-primary/50"
                            )} />
                          )}
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <Card key={mIdx} className={`overflow-hidden transition-all duration-300 hover:shadow-md ${isCompleted ? "bg-muted/30 border-primary/20" : "hover:border-primary/30"}`}>
                      <CardHeader className="py-4 flex flex-row items-center gap-4">
                        {isEnrolled && onToggleModuleCompletion && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              onToggleModuleCompletion(finalIndex, Boolean(isCompleted));
                            }}
                            className="shrink-0 transition-all hover:scale-110 focus:outline-none z-10"
                          >
                            {isCompleted ? (
                              <CheckCircle className="h-6 w-6 text-primary fill-primary/10" />
                            ) : (
                              <Circle className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" />
                            )}
                          </button>
                        )}
                        <Link
                          href={`/${schoolSlug}/courses/${courseId}/modules/${finalIndex}`}
                          className="flex-1 group"
                        >
                          <CardTitle className="text-base font-semibold flex items-center gap-3 group-hover:text-primary transition-colors">
                            <div className="p-1.5 rounded-md bg-background border border-border/50 shadow-sm group-hover:border-primary/30 transition-colors">
                              {mod.type === "video" ? (
                                <PlayCircle className="h-4 w-4 text-blue-500" />
                              ) : mod.type === "pdf" ? (
                                <File className="h-4 w-4 text-red-500" />
                              ) : (
                                <FileText className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                            {mod.title}
                          </CardTitle>
                        </Link>
                      </CardHeader>
                      {isEnrolled && (
                        <Link href={`/${schoolSlug}/courses/${courseId}/modules/${finalIndex}`}>
                          <CardContent className="pt-0 pb-5 px-6 border-t border-border/5 text-sm cursor-pointer hover:bg-muted/10 transition-colors group">
                            <div className="mt-4 flex items-center justify-between">
                              {mod.type === "video" && mod.content.includes("http") ? (
                                <div className="inline-flex items-center gap-2 text-primary font-medium group-hover:underline">
                                  <PlayCircle className="h-4 w-4" />
                                  Watch Video Lesson
                                </div>
                              ) : (
                                <div className="text-muted-foreground line-clamp-2 italic">
                                  {mod.content.replace(/<[^>]+>/g, '').substring(0, 100)}...
                                </div>
                              )}
                              <div className="text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                Open Lesson →
                              </div>
                            </div>
                          </CardContent>
                        </Link>
                      )}
                    </Card>
                  );
                })}

                {section.quiz && section.quiz.questions?.length > 0 && (
                  (() => {
                    const isCompleted = user && section.quiz.passedBy?.some((p: any) => p.uid === user?.uid);
                    const isActive = activeItemType === "quiz" && activeIndex === sIdx;

                    if (isSidebar) {
                      return (
                        <Link href={`/${schoolSlug}/courses/${courseId}/quiz/${sIdx}`} key={`quiz-${sIdx}`}>
                          <div className={cn(
                            "p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 group border border-transparent",
                            isActive ? "bg-background border-border shadow-sm" : "hover:bg-background/50",
                            !isActive && isCompleted && "opacity-70"
                          )}>
                            <div className={cn(
                              "shrink-0 p-1.5 rounded-lg border shadow-xs transition-colors",
                              isActive ? "bg-indigo-500 text-white border-indigo-500" : "bg-background group-hover:border-indigo-500/30 group-hover:text-indigo-500"
                            )}>
                              <FileText className={cn("h-3.5 w-3.5", !isActive && "text-indigo-500")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-xs font-bold truncate transition-colors",
                                isActive ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground group-hover:text-foreground"
                              )}>
                                Section Quiz
                              </p>
                            </div>
                            {isCompleted && (
                              <CheckCircle className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                isActive ? "text-indigo-500" : "text-green-500/50"
                              )} />
                            )}
                          </div>
                        </Link>
                      );
                    }

                    return (
                      <Card key={`quiz-${sIdx}`} className={`overflow-hidden transition-all duration-300 hover:shadow-md ${isCompleted ? "bg-green-500/10 border-green-500/30" : "hover:border-primary/30"}`}>
                        <CardHeader className="py-4 flex flex-row items-center gap-4">
                          {isEnrolled && (
                            <div className="shrink-0 z-10">
                              {isCompleted ? (
                                <CheckCircle className="h-6 w-6 text-green-500 fill-green-500/10" />
                              ) : (
                                <Circle className="h-6 w-6 text-muted-foreground transition-colors" />
                              )}
                            </div>
                          )}
                          <Link href={`/${schoolSlug}/courses/${courseId}/quiz/${sIdx}`} className="flex-1 group">
                            <CardTitle className="text-base font-semibold flex items-center gap-3 lg:group-hover:text-primary transition-colors">
                              <div className="p-1.5 rounded-md bg-background border border-border/50 shadow-sm group-hover:border-primary/30 transition-colors">
                                <FileText className="h-4 w-4 text-indigo-500" />
                              </div>
                              Section Quiz
                            </CardTitle>
                          </Link>
                        </CardHeader>
                        {isEnrolled && (
                          <Link href={`/${schoolSlug}/courses/${courseId}/quiz/${sIdx}`}>
                            <CardContent className="pt-0 pb-5 px-6 border-t border-border/5 text-sm cursor-pointer hover:bg-muted/10 transition-colors group">
                              <div className="mt-4 flex items-center justify-between">
                                <div className="inline-flex items-center gap-2 text-indigo-500 font-medium group-hover:underline">
                                  Take Quiz ({section.quiz.questions.length} questions)
                                </div>
                                <div className="text-xs font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Start →
                                </div>
                              </div>
                            </CardContent>
                          </Link>
                        )}
                      </Card>
                    );
                  })()
                )}

                {section.type === "case_study" && section.caseStudy && (
                  (() => {
                    const isCompleted = user && section.caseStudy.completedBy?.includes(user?.uid);
                    const isActive = activeItemType === "case_study" && activeIndex === sIdx;

                    if (isSidebar) {
                      return (
                        <Link href={`/${schoolSlug}/courses/${courseId}/case-study/${sIdx}`} key={`cs-${sIdx}`}>
                          <div className={cn(
                            "p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 group border border-transparent",
                            isActive ? "bg-background border-border shadow-sm" : "hover:bg-background/50",
                            !isActive && isCompleted && "opacity-70"
                          )}>
                            <div className={cn(
                              "shrink-0 p-1.5 rounded-lg border shadow-xs transition-colors",
                              isActive ? "bg-orange-500 text-white border-orange-500" : "bg-background group-hover:border-orange-500/30 group-hover:text-orange-500"
                            )}>
                              <FileText className={cn("h-3.5 w-3.5", !isActive && "text-orange-500")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-xs font-bold truncate transition-colors",
                                isActive ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground group-hover:text-foreground"
                              )}>
                                Case Study
                              </p>
                            </div>
                            {isCompleted && (
                              <CheckCircle className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                isActive ? "text-orange-500" : "text-green-500/50"
                              )} />
                            )}
                          </div>
                        </Link>
                      );
                    }

                    return (
                      <Card key={`cs-${sIdx}`} className={`overflow-hidden transition-all duration-300 hover:shadow-md ${isCompleted ? "bg-green-500/10 border-green-500/30" : "hover:border-primary/30"}`}>
                        <CardHeader className="py-4 flex flex-row items-center gap-4">
                          {isEnrolled && (
                            <div className="shrink-0 z-10">
                              {isCompleted ? (
                                <CheckCircle className="h-6 w-6 text-green-500 fill-green-500/10" />
                              ) : (
                                <Circle className="h-6 w-6 text-muted-foreground transition-colors" />
                              )}
                            </div>
                          )}
                          <Link href={`/${schoolSlug}/courses/${courseId}/case-study/${sIdx}`} className="flex-1 group">
                            <CardTitle className="text-base font-semibold flex items-center gap-3 lg:group-hover:text-primary transition-colors">
                              <div className="p-1.5 rounded-md bg-background border border-border/50 shadow-sm group-hover:border-primary/30 transition-colors">
                                <FileText className="h-4 w-4 text-orange-500" />
                              </div>
                              Case Study
                            </CardTitle>
                          </Link>
                        </CardHeader>
                        {isEnrolled && (
                          <Link href={`/${schoolSlug}/courses/${courseId}/case-study/${sIdx}`}>
                            <CardContent className="pt-0 pb-5 px-6 border-t border-border/5 text-sm cursor-pointer hover:bg-muted/10 transition-colors group">
                              <div className="mt-4 flex items-center justify-between">
                                <div className="inline-flex items-center gap-2 text-orange-500 font-medium group-hover:underline">
                                  View Case Study Details
                                </div>
                                <div className="text-xs font-bold text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Open →
                                </div>
                              </div>
                            </CardContent>
                          </Link>
                        )}
                      </Card>
                    );
                  })()
                )}

                {section.type === "final_assessment" && section.finalAssessment && (
                  (() => {
                    const isCompleted = user && section.finalAssessment.completedBy?.includes(user?.uid);
                    const isActive = activeItemType === "final_assessment" && activeIndex === sIdx;

                    if (isSidebar) {
                      return (
                        <Link href={`/${schoolSlug}/courses/${courseId}/final-assessment/${sIdx}`} key={`fa-${sIdx}`}>
                          <div className={cn(
                            "p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 group border border-transparent",
                            isActive ? "bg-background border-border shadow-sm" : "hover:bg-background/50",
                            !isActive && isCompleted && "opacity-70"
                          )}>
                            <div className={cn(
                              "shrink-0 p-1.5 rounded-lg border shadow-xs transition-colors",
                              isActive ? "bg-teal-500 text-white border-teal-500" : "bg-background group-hover:border-teal-500/30 group-hover:text-teal-500"
                            )}>
                              <ClipboardList className={cn("h-3.5 w-3.5", !isActive && "text-teal-500")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-xs font-bold truncate transition-colors",
                                isActive ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground group-hover:text-foreground"
                              )}>
                                Final Assessment
                              </p>
                            </div>
                            {isCompleted && (
                              <CheckCircle className={cn(
                                "h-3.5 w-3.5 shrink-0",
                                isActive ? "text-teal-500" : "text-green-500/50"
                              )} />
                            )}
                          </div>
                        </Link>
                      );
                    }

                    return (
                      <Card key={`fa-${sIdx}`} className={`overflow-hidden transition-all duration-300 hover:shadow-md ${isCompleted ? "bg-green-500/10 border-green-500/30" : "hover:border-primary/30"}`}>
                        <CardHeader className="py-4 flex flex-row items-center gap-4">
                          {isEnrolled && (
                            <div className="shrink-0 z-10">
                              {isCompleted ? (
                                <CheckCircle className="h-6 w-6 text-green-500 fill-green-500/10" />
                              ) : (
                                <Circle className="h-6 w-6 text-muted-foreground transition-colors" />
                              )}
                            </div>
                          )}
                          <Link href={`/${schoolSlug}/courses/${courseId}/final-assessment/${sIdx}`} className="flex-1 group">
                            <CardTitle className="text-base font-semibold flex items-center gap-3 lg:group-hover:text-primary transition-colors">
                              <div className="p-1.5 rounded-md bg-background border border-border/50 shadow-sm group-hover:border-primary/30 transition-colors">
                                <ClipboardList className="h-4 w-4 text-teal-500" />
                              </div>
                              Final Assessment
                            </CardTitle>
                          </Link>
                        </CardHeader>
                        {isEnrolled && (
                          <Link href={`/${schoolSlug}/courses/${courseId}/final-assessment/${sIdx}`}>
                            <CardContent className="pt-0 pb-5 px-6 border-t border-border/5 text-sm cursor-pointer hover:bg-muted/10 transition-colors group">
                              <div className="mt-4 flex items-center justify-between">
                                <div className="inline-flex items-center gap-2 text-teal-500 font-medium group-hover:underline">
                                  Go to Final Assessment
                                </div>
                                <div className="text-xs font-bold text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Start →
                                </div>
                              </div>
                            </CardContent>
                          </Link>
                        )}
                      </Card>
                    );
                  })()
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  } else {
    // Legacy support for flat modules without sections
    return (
      <div className={cn(isSidebar ? "space-y-1" : "space-y-4")}>
        {course.modules?.map((mod: any, i: number) => {
          const isCompleted = user && mod.completedBy?.includes(user.uid);
          const isActive = activeItemType === "module" && activeIndex === i;

          if (isSidebar) {
            return (
              <Link key={i} href={`/${schoolSlug}/courses/${courseId}/modules/${i}`}>
                <div className={cn(
                  "p-3 rounded-xl transition-all cursor-pointer flex items-center gap-3 group border border-transparent",
                  isActive ? "bg-background border-border shadow-sm" : "hover:bg-background/50",
                  !isActive && isCompleted && "opacity-70"
                )}>
                  <div className={cn(
                    "shrink-0 p-1.5 rounded-lg border shadow-xs transition-colors",
                    isActive ? "bg-primary text-primary-foreground border-primary" : "bg-background group-hover:border-primary/30 group-hover:text-primary"
                  )}>
                    {mod.type === "video" ? <PlayCircle className="h-3.5 w-3.5" /> : mod.type === "pdf" ? <File className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-xs font-bold truncate transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}>
                      {mod.title}
                    </p>
                  </div>
                  {isCompleted && (
                    <CheckCircle className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isActive ? "text-primary" : "text-primary/50"
                    )} />
                  )}
                </div>
              </Link>
            );
          }

          return (
            <Card key={i} className={`transition-all duration-300 ${isCompleted ? "bg-muted/30 border-primary/30" : "hover:border-primary/30"}`}>
              <CardHeader className="py-4 flex flex-row items-center gap-4">
                {isEnrolled && onToggleModuleCompletion && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onToggleModuleCompletion(i, Boolean(isCompleted));
                    }}
                    className="shrink-0 hover:scale-110 transition-transform focus:outline-none z-10"
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-6 w-6 text-primary fill-primary/10" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" />
                    )}
                  </button>
                )}
                <Link
                  href={`/${schoolSlug}/courses/${courseId}/modules/${i}`}
                  className="flex-1 group"
                >
                  <CardTitle className="text-lg flex items-center gap-3 font-semibold group-hover:text-primary transition-colors">
                    <div className="p-1.5 rounded-md bg-background border border-border/50 shadow-sm group-hover:border-primary/30 transition-colors">
                      {mod.type === "video" ? (
                        <PlayCircle className="h-4 w-4 text-blue-500" />
                      ) : mod.type === "pdf" ? (
                        <File className="h-4 w-4 text-red-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    {mod.title}
                  </CardTitle>
                </Link>
              </CardHeader>
              {isEnrolled && (
                <Link href={`/${schoolSlug}/courses/${courseId}/modules/${i}`}>
                  <CardContent className="pt-0 pb-5 px-6 border-t border-border/5 text-sm cursor-pointer hover:bg-muted/10 transition-colors group">
                    <div className="mt-4 flex items-center justify-between">
                      {mod.type === "video" && mod.content.includes("http") ? (
                        <div className="inline-flex items-center gap-2 text-primary font-medium group-hover:underline">
                          <PlayCircle className="h-4 w-4" />
                          Watch Video Lesson
                        </div>
                      ) : (
                        <div className="text-muted-foreground line-clamp-2 italic">
                          {mod.content.replace(/<[^>]+>/g, '').substring(0, 100)}...
                        </div>
                      )}
                      <div className="text-xs font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Open Lesson →
                      </div>
                    </div>
                  </CardContent>
                </Link>
              )}
            </Card>
          );
        })}
        {(!course.modules || course.modules.length === 0) && !isSidebar && (
          <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/5">
            <BookOpen className="h-10 w-10 mx-auto mb-4 opacity-20" />
            <p>No modules have been added to this course yet.</p>
          </div>
        )}
      </div>
    );
  }
}

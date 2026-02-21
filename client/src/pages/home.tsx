import { useEffect, useState, useRef } from "react";
import { useLocation, Link } from "wouter";
import {
  ArrowRight,
  ArrowUp,
  ArrowLeft,
  CheckCircle2,
  Upload,
  Brain,
  Zap,
  BookOpen,
  Share2,
  RotateCcw,
  Sparkles,
  Play,
  Eye,
  Target,
  Users,
  Star,
  ChevronRight,
  ChevronLeft,
  Layers,
  GraduationCap,
  Trophy,
  MousePointer2,
  Check,
  MessageCircle,
  FileText,
  File,
  Image,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  AlertCircle,
  ArrowDown,
  CheckCheck,
  Import,
  ClipboardCheck,
  CircleDot,
  Shield,
  ListCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/file-upload";
import { useQuiz } from "@/lib/quiz-context";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDialog } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import logoImage from "@assets/image_1765894870887.png";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
  useMotionValue,
  animate,
} from "framer-motion";
import { Footer } from "@/components/footer";

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function Doodle({
  d,
  color,
  className,
  delay = 0,
  width,
  height,
  viewBox = "0 0 100 100",
  strokeW = 2.5,
  fill = false,
  animate: shouldAnimate = true,
}: {
  d: string;
  color: string;
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  viewBox?: string;
  strokeW?: number;
  fill?: boolean;
  animate?: boolean;
}) {
  return (
    <motion.svg
      {...(width ? { width, height: height || width } : {})}
      viewBox={viewBox}
      fill="none"
      preserveAspectRatio="none"
      className={cn("pointer-events-none", color, className)}
      initial={{ opacity: 0, scale: 0.7 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5, type: "spring", stiffness: 200 }}
    >
      {shouldAnimate ? (
        <motion.path
          d={d}
          stroke="currentColor"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={fill ? "currentColor" : "none"}
          fillOpacity={fill ? 0.12 : 0}
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ delay, duration: 0.8, ease: "easeOut" }}
        />
      ) : (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={fill ? "currentColor" : "none"}
          fillOpacity={fill ? 0.12 : 0}
        />
      )}
    </motion.svg>
  );
}

const D = {
  wavyUnderline: "M3 9C20 5 40 11 60 7C80 3 100 12 120 6C140 2 160 10 197 5",
  loopUnderline:
    "M5 12C15 4 25 4 30 12C35 20 45 4 55 4C65 4 70 16 80 12C90 8 95 4 100 8C110 12 120 4 130 8C140 12 155 4 165 8C175 12 185 6 195 8",
  doubleUnderline:
    "M5 6C40 3 80 9 120 4C150 0 180 7 195 5 M5 14C30 10 70 16 110 11C150 7 180 14 195 12",
  zigzagUnderline:
    "M5 10L15 4L25 10L35 4L45 10L55 4L65 10L75 4L85 10L95 4L105 10L115 4L125 10L135 4L145 10L155 4L165 10L175 4L185 10L195 4",
  star: "M20 4L23 15L34 15L25 22L28 33L20 27L12 33L15 22L6 15L17 15Z",
  sparkle4: "M15 3L17 12L26 15L17 18L15 27L13 18L4 15L13 12Z",
  sparkle6:
    "M20 2L22 14L32 8L24 17L34 22L22 21L20 33L18 21L6 22L16 17L8 8L18 14Z",
  heart:
    "M20 14C20 8 28 4 28 12C28 18 20 26 20 26C20 26 12 18 12 12C12 4 20 8 20 14Z",
  lightning: "M18 4L12 18H20L14 34L28 16H20L26 4Z",
  arrow: "M5 20C15 18 25 10 35 12C45 14 50 8 55 6M48 3L55 6L52 13",
  curlyArrow: "M8 28C8 14 18 6 28 8C38 10 40 22 32 26M25 22L32 26L28 32",
  circle:
    "M20 6C32 4 38 14 38 22C38 30 30 38 20 38C10 38 2 28 2 20C2 12 10 6 20 6Z",
  spiral:
    "M22 22C22 18 26 18 26 22C26 28 16 28 16 20C16 12 28 12 28 24C28 32 14 32 14 18",
  book: "M20 8L20 34 M20 8C16 7 8 5 4 8L4 33C8 30 16 31 20 34 M20 8C24 7 32 5 36 8L36 33C32 30 24 31 20 34",
  pencil:
    "M8 34L26 14L30 18L12 38L6 36Z M26 14L28 10C29 9 31 9 32 10L34 12C35 13 35 15 34 16L30 18",
  lightbulb:
    "M16 30L24 30 M17 33L23 33 M20 33L20 36 M14 24C14 18 16 10 20 10C24 10 26 18 26 24C26 27 24 29 22 30L18 30C16 29 14 27 14 24",
  rocket:
    "M20 6C16 14 14 22 16 30L20 33L24 30C26 22 24 14 20 6 M16 26L10 30 M24 26L30 30",
  trophy:
    "M10 10L30 10L28 22C27 26 24 28 20 30C16 28 13 26 12 22L10 10 M8 10L6 16 M32 10L34 16 M16 30L16 34L24 34L24 30 M14 34L26 34",
  music:
    "M22 8L22 28C22 31 18 31 18 28C18 25 22 25 22 28 M22 8L30 6L30 24C30 27 26 27 26 24C26 21 30 21 30 24",
  flower:
    "M20 20C20 14 26 14 26 20 M20 20C26 20 26 26 20 26 M20 20C20 26 14 26 14 20 M20 20C14 20 14 14 20 14 M20 26L20 36",
  sun: "M20 12C24 12 28 16 28 20C28 24 24 28 20 28C16 28 12 24 12 20C12 16 16 12 20 12 M20 4L20 8 M20 32L20 36 M4 20L8 20 M32 20L36 20 M8 8L11 11 M29 29L32 32 M32 8L29 11 M11 29L8 32",
  cloud:
    "M12 24C6 24 4 18 8 16C6 12 10 8 16 10C18 6 26 6 28 10C34 8 36 14 32 18C36 20 34 24 30 24Z",
  crown: "M6 28L10 12L16 20L20 8L24 20L30 12L34 28Z",
  diamond: "M20 4L36 20L20 36L4 20Z",
  check: "M8 20L16 28L32 10",
  paperPlane: "M4 20L36 6L24 34L20 22L4 20 M20 22L36 6",
  swirl: "M28 20C28 12 20 8 14 14C8 20 14 28 20 28C28 28 32 20 28 14",
  dots3:
    "M10 20 M10 18C11 18 12 19 12 20C12 21 11 22 10 22C9 22 8 21 8 20C8 19 9 18 10 18 M20 18C21 18 22 19 22 20C22 21 21 22 20 22C19 22 18 21 18 20C18 19 19 18 20 18 M30 18C31 18 32 19 32 20C32 21 31 22 30 22C29 22 28 21 28 20C28 19 29 18 30 18",
  wave: "M4 20C8 12 14 12 18 20C22 28 28 28 32 20C36 12 40 12 44 20",
};

function HandwrittenPaper() {
  return (
    <div
      className="w-full h-full bg-[#fdf6e3] relative overflow-hidden select-none"
      style={{ fontFamily: "'Indie Flower', cursive" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "repeating-linear-gradient(transparent, transparent 24px, #c4daf422 24px, #c4daf422 25px)",
        }}
      />
      <div
        className="absolute left-[48px] md:left-[64px] lg:left-[80px] top-0 bottom-0 w-[1px] pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent, #e8a0a0aa 10%, #e8a0a0aa 90%, transparent)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 pl-[56px] pr-4 pt-4 pb-4 md:pl-[72px] md:pr-6 md:pt-6 md:pb-6 lg:pl-[88px] lg:pr-8 lg:pt-7 lg:pb-7">
        <div className="mb-1 md:mb-2">
          <span
            className="text-[13px] md:text-[16px] lg:text-[18px] font-bold text-gray-800"
            style={{ transform: "rotate(-0.5deg)", display: "inline-block" }}
          >
            Cell Biology - Ch. 5 Notes
          </span>
          <svg
            className="w-[140px] md:w-[180px] lg:w-[210px] h-[4px] block mt-[-1px]"
            viewBox="0 0 140 4"
            fill="none"
          >
            <path
              d="M2 2.5 Q 30 0.5, 70 2.2 Q 100 3.5, 138 1.5"
              stroke="#374151"
              strokeWidth="0.8"
              opacity="0.5"
              fill="none"
            />
          </svg>
        </div>

        <div
          className="mt-3 mb-2.5 md:mt-4 md:mb-3"
          style={{ transform: "rotate(0.3deg)" }}
        >
          <p
            className="text-[11px] md:text-[13px] lg:text-[14px] text-gray-700 leading-[22px] md:leading-[28px] lg:leading-[30px] tracking-[-0.01em]"
            style={{ transform: "rotate(-0.2deg)" }}
          >
            <span className="font-bold text-gray-800">Mitochondria</span> =
            "powerhouse of the cell"
          </p>
          <p
            className="text-[10.5px] md:text-[12.5px] lg:text-[13.5px] text-gray-600 leading-[22px] md:leading-[28px] lg:leading-[30px] ml-2 md:ml-3 mt-0.5"
            style={{ transform: "rotate(0.4deg)" }}
          >
            - produces ATP (energy!)
          </p>
          <p
            className="text-[10.5px] md:text-[12.5px] lg:text-[13.5px] text-gray-600 leading-[22px] md:leading-[28px] lg:leading-[30px] ml-2 md:ml-3"
            style={{ transform: "rotate(-0.3deg)" }}
          >
            - through cellular respiration
          </p>
          <p
            className="text-[10.5px] md:text-[12.5px] lg:text-[13.5px] text-gray-600 leading-[22px] md:leading-[28px] lg:leading-[30px] ml-2 md:ml-3"
            style={{ transform: "rotate(0.2deg)" }}
          >
            - has double membrane
          </p>
        </div>

        <svg
          className="w-full h-[34px] md:h-[42px] lg:h-[48px] my-1 md:my-1.5"
          viewBox="0 0 220 34"
          fill="none"
        >
          <ellipse
            cx="110"
            cy="17"
            rx="30"
            ry="12"
            stroke="#6b7280"
            strokeWidth="0.7"
            fill="#fef9c3"
            fillOpacity="0.3"
            transform="rotate(-2 110 17)"
          />
          <ellipse
            cx="110"
            cy="17"
            rx="22"
            ry="8"
            stroke="#6b7280"
            strokeWidth="0.5"
            fill="none"
            strokeDasharray="2 1.5"
            transform="rotate(1 110 17)"
          />
          <path
            d="M87 11 Q 95 8, 110 9 Q 125 10, 133 13"
            stroke="#6b7280"
            strokeWidth="0.4"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M85 20 Q 98 22, 110 21 Q 120 20, 135 22"
            stroke="#6b7280"
            strokeWidth="0.4"
            fill="none"
            opacity="0.6"
          />
          <text
            x="155"
            y="13"
            fill="#6b7280"
            fontSize="5.5"
            fontFamily="'Indie Flower', cursive"
            opacity="0.7"
            transform="rotate(-1 155 13)"
          >
            outer
          </text>
          <line
            x1="145"
            y1="12"
            x2="136"
            y2="14"
            stroke="#6b7280"
            strokeWidth="0.4"
            opacity="0.5"
          />
          <text
            x="155"
            y="23"
            fill="#6b7280"
            fontSize="5.5"
            fontFamily="'Indie Flower', cursive"
            opacity="0.7"
            transform="rotate(0.5 155 23)"
          >
            inner
          </text>
          <line
            x1="145"
            y1="22"
            x2="132"
            y2="20"
            stroke="#6b7280"
            strokeWidth="0.4"
            opacity="0.5"
          />
          <text
            x="42"
            y="20"
            fill="#9ca3af"
            fontSize="5"
            fontFamily="'Indie Flower', cursive"
            opacity="0.6"
            transform="rotate(-1 42 20)"
          >
            cristae folds ^
          </text>
          <path
            d="M66 18 Q 75 14, 88 15"
            stroke="#9ca3af"
            strokeWidth="0.35"
            fill="none"
            opacity="0.5"
            markerEnd=""
          />
        </svg>

        <div
          className="mt-1 mb-2 md:mt-2 md:mb-2.5"
          style={{ transform: "rotate(-0.2deg)" }}
        >
          <p
            className="text-[11px] md:text-[13px] lg:text-[14px] text-gray-700 leading-[22px] md:leading-[28px] lg:leading-[30px]"
            style={{ transform: "rotate(0.3deg)" }}
          >
            <span className="font-bold text-gray-800">Key process:</span>{" "}
            glucose + O₂ → ATP
          </p>
          <p
            className="text-[10.5px] md:text-[12.5px] lg:text-[13.5px] text-gray-500 leading-[22px] md:leading-[28px] lg:leading-[30px] ml-2 md:ml-3 italic"
            style={{ transform: "rotate(-0.4deg)" }}
          >
            (36-38 ATP per glucose molecule)
          </p>
        </div>

        <div
          className="mt-2 relative md:mt-3"
          style={{ transform: "rotate(0.4deg)" }}
        >
          <p
            className="text-[10.5px] md:text-[12.5px] lg:text-[13.5px] text-gray-600 leading-[22px] md:leading-[28px] lg:leading-[30px]"
            style={{ transform: "rotate(-0.3deg)" }}
          >
            Q: primary function of mitochondria?
          </p>
          <div className="ml-3 md:ml-4 mt-0.5 relative inline-block">
            <span
              className="text-[10.5px] md:text-[12.5px] lg:text-[13.5px] text-gray-700 font-semibold"
              style={{ transform: "rotate(0.2deg)", display: "inline-block" }}
            >
              → Energy production (ATP)
            </span>
            <svg
              className="absolute -left-1 top-1/2 -translate-y-1/2 w-[calc(100%+8px)] h-[16px] md:h-[20px] pointer-events-none"
              viewBox="0 0 160 16"
              preserveAspectRatio="none"
            >
              <ellipse
                cx="80"
                cy="8"
                rx="76"
                ry="6.5"
                fill="none"
                stroke="#4a8fe2"
                strokeWidth="0.9"
                opacity="0.35"
                transform="rotate(-0.8 80 8)"
              />
            </svg>
          </div>
        </div>

        <svg
          className="w-[80%] h-[2px] my-2.5 md:my-3 ml-1"
          viewBox="0 0 180 2"
          fill="none"
        >
          <path
            d="M0 1 Q 40 0, 90 1.2 Q 140 2, 180 0.8"
            stroke="#d1d5db"
            strokeWidth="0.5"
            opacity="0.6"
            fill="none"
          />
        </svg>

        <div
          className="mt-1 mb-2 md:mt-2 md:mb-2.5"
          style={{ transform: "rotate(-0.3deg)" }}
        >
          <p
            className="text-[11px] md:text-[13px] lg:text-[14px] text-gray-800 font-bold leading-[22px] md:leading-[28px] lg:leading-[30px]"
            style={{ transform: "rotate(0.2deg)" }}
          >
            Other organelles:
          </p>
          <p
            className="text-[10.5px] md:text-[12.5px] lg:text-[13.5px] text-gray-600 leading-[22px] md:leading-[28px] lg:leading-[30px] ml-2 md:ml-3"
            style={{ transform: "rotate(0.3deg)" }}
          >
            - Ribosomes → protein synthesis
          </p>
          <p
            className="text-[10.5px] md:text-[12.5px] lg:text-[13.5px] text-gray-600 leading-[22px] md:leading-[28px] lg:leading-[30px] ml-2 md:ml-3"
            style={{ transform: "rotate(-0.2deg)" }}
          >
            - ER (rough = ribosomes, smooth = lipids)
          </p>
          <p
            className="text-[10.5px] md:text-[12.5px] lg:text-[13.5px] text-gray-600 leading-[22px] md:leading-[28px] lg:leading-[30px] ml-2 md:ml-3 relative"
            style={{ transform: "rotate(0.4deg)" }}
          >
            <span className="line-through decoration-red-400/40">
              - Lysosomes break down food
            </span>
            <span className="text-[9px] md:text-[10.5px] text-red-400/50 ml-1 italic">
              *waste, not food
            </span>
          </p>
          <p
            className="text-[10.5px] md:text-[12.5px] lg:text-[13.5px] text-gray-600 leading-[22px] md:leading-[28px] lg:leading-[30px] ml-2 md:ml-3"
            style={{ transform: "rotate(-0.1deg)" }}
          >
            - Golgi body → packages proteins
          </p>
        </div>

        <div
          className="mt-2 mb-1 md:mt-2.5 md:mb-1.5"
          style={{ transform: "rotate(0.2deg)" }}
        >
          <p
            className="text-[10px] md:text-[12px] lg:text-[13px] text-gray-500 leading-[20px] md:leading-[26px] lg:leading-[28px] italic"
            style={{ transform: "rotate(-0.3deg)" }}
          >
            remember: "cells are like tiny factories"
          </p>
          <p
            className="text-[10px] md:text-[12px] lg:text-[13px] text-gray-500 leading-[20px] md:leading-[26px] lg:leading-[28px] ml-2 md:ml-3"
            style={{ transform: "rotate(0.5deg)" }}
          >
            each organelle = different department
          </p>
        </div>

        <div
          className="mt-2.5 relative md:mt-3"
          style={{ transform: "rotate(-0.4deg)" }}
        >
          <p
            className="text-[10.5px] md:text-[12.5px] lg:text-[13.5px] text-gray-700 leading-[22px] md:leading-[28px] lg:leading-[30px]"
            style={{ transform: "rotate(0.2deg)" }}
          >
            <span className="font-bold">Test review:</span>
          </p>
          <p
            className="text-[10px] md:text-[12px] lg:text-[13px] text-gray-500 leading-[20px] md:leading-[26px] lg:leading-[28px] ml-2 md:ml-3"
            style={{ transform: "rotate(-0.2deg)" }}
          >
            ☐ memorize organelle functions
          </p>
          <p
            className="text-[10px] md:text-[12px] lg:text-[13px] text-gray-500 leading-[20px] md:leading-[26px] lg:leading-[28px] ml-2 md:ml-3"
            style={{ transform: "rotate(0.3deg)" }}
          >
            ☐ draw + label cell diagram
          </p>
          <p
            className="text-[10px] md:text-[12px] lg:text-[13px] text-gray-500 leading-[20px] md:leading-[26px] lg:leading-[28px] ml-2 md:ml-3"
            style={{ transform: "rotate(-0.1deg)" }}
          >
            ☑ ATP production steps
          </p>
        </div>

        <svg
          className="absolute bottom-[70px] md:bottom-[90px] right-[12px] md:right-[20px] w-[45px] md:w-[60px] lg:w-[70px] h-[45px] md:h-[60px] lg:h-[70px] pointer-events-none"
          viewBox="0 0 45 45"
          fill="none"
        >
          <circle
            cx="22"
            cy="22"
            r="16"
            stroke="#d1d5db"
            strokeWidth="0.5"
            fill="none"
            opacity="0.3"
            transform="rotate(3 22 22)"
          />
          <circle
            cx="22"
            cy="22"
            r="5"
            stroke="#d1d5db"
            strokeWidth="0.4"
            fill="#fef9c3"
            fillOpacity="0.2"
            opacity="0.3"
          />
          <line
            x1="22"
            y1="6"
            x2="22"
            y2="14"
            stroke="#d1d5db"
            strokeWidth="0.35"
            opacity="0.25"
          />
          <line
            x1="22"
            y1="30"
            x2="22"
            y2="38"
            stroke="#d1d5db"
            strokeWidth="0.35"
            opacity="0.25"
          />
          <line
            x1="6"
            y1="22"
            x2="14"
            y2="22"
            stroke="#d1d5db"
            strokeWidth="0.35"
            opacity="0.25"
          />
          <line
            x1="30"
            y1="22"
            x2="38"
            y2="22"
            stroke="#d1d5db"
            strokeWidth="0.35"
            opacity="0.25"
          />
          <text
            x="22"
            y="24"
            fill="#9ca3af"
            fontSize="4"
            textAnchor="middle"
            fontFamily="'Indie Flower', cursive"
            opacity="0.4"
          >
            cell
          </text>
        </svg>

        <div className="absolute top-4 right-3 md:top-6 md:right-5">
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            className="md:w-[28px] md:h-[28px] lg:w-[32px] lg:h-[32px]"
          >
            <path
              d="M6 2 L16 2 Q20 2 20 6 L20 16 Q20 20 16 20 L6 20 Q2 20 2 16 L2 6 Q2 2 6 2Z"
              stroke="#d1d5db"
              strokeWidth="0.6"
              fill="none"
              opacity="0.5"
              transform="rotate(2 11 11)"
            />
            <path
              d="M6 8 L16 8 M6 12 L14 12 M6 16 L10 16"
              stroke="#d1d5db"
              strokeWidth="0.5"
              opacity="0.35"
            />
          </svg>
        </div>

        <div
          className="absolute bottom-3 right-4 md:bottom-4 md:right-6 text-[8px] md:text-[10px] text-gray-400/50 italic"
          style={{ transform: "rotate(-1deg)" }}
        >
          pg. 47-48
        </div>

        <svg
          className="absolute top-[60px] md:top-[76px] right-[10px] md:right-[16px] w-[14px] md:w-[18px] h-[40px] md:h-[50px] pointer-events-none"
          viewBox="0 0 14 40"
          fill="none"
        >
          <path
            d="M7 2 L7 32 M3 28 L7 34 L11 28"
            stroke="#d97706"
            strokeWidth="0.7"
            opacity="0.3"
          />
        </svg>

        <div
          className="absolute top-[54px] md:top-[68px] right-[28px] md:right-[38px] text-[7px] md:text-[9px] text-amber-600/30 italic"
          style={{ transform: "rotate(-2deg)" }}
        >
          imp!
        </div>
      </div>
    </div>
  );
}

function PrepetualQuizPlayer() {
  const q = {
    num: 1,
    total: 3,
    q: "What is the primary function of mitochondria in a cell?",
    options: [
      { label: "A", text: "Energy production", correct: true, selected: true },
      {
        label: "B",
        text: "Protein synthesis",
        correct: false,
        selected: false,
      },
      { label: "C", text: "Cell division", correct: false, selected: false },
      { label: "D", text: "Waste removal", correct: false, selected: false },
    ],
  };

  const progress = (q.num / q.total) * 100;

  return (
    <div className="w-full h-full bg-background flex flex-col overflow-hidden">
      <div className="px-5 pt-4 pb-2.5 border-b border-border/30 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-brand text-[13px] font-bold text-primary tracking-tight">
            Prepetual
          </span>
        </div>
        <div className="h-1 bg-muted/80 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[9px] text-muted-foreground font-medium">
            Question {q.num} of {q.total}
          </span>
          <span className="text-[9px] text-muted-foreground/70">
            Multiple Choice
          </span>
        </div>
      </div>

      <div className="flex-1 px-5 py-4 overflow-hidden">
        <div className="px-3 py-2.5 rounded-lg bg-muted/40 border border-border/30 mb-3.5">
          <p className="text-[11.5px] font-medium text-foreground leading-relaxed">
            {q.q}
          </p>
        </div>

        <div className="space-y-2">
          {q.options.map((opt, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: 0.6 + i * 0.08,
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`px-3 py-2 rounded-lg border text-[10.5px] font-medium flex items-center gap-2.5 transition-colors ${
                opt.correct && opt.selected
                  ? "border-green-500/40 bg-green-500/8 text-green-700 dark:text-green-400"
                  : "border-border/60 bg-card/50 text-foreground"
              }`}
            >
              <div
                className={`w-[18px] h-[18px] rounded-md flex items-center justify-center text-[8px] font-bold shrink-0 ${
                  opt.correct && opt.selected
                    ? "bg-green-500 text-white"
                    : "bg-muted/80 text-muted-foreground border border-border/40"
                }`}
              >
                {opt.correct && opt.selected ? (
                  <Check className="w-2.5 h-2.5" />
                ) : (
                  opt.label
                )}
              </div>
              <span>{opt.text}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 px-3 py-2.5 rounded-lg bg-green-500/5 border border-green-500/15"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Lightbulb className="w-3 h-3 text-green-600 dark:text-green-400" />
            <span className="text-[9px] font-semibold text-green-700 dark:text-green-400">
              Correct!
            </span>
          </div>
          <p className="text-[8.5px] text-green-700/70 dark:text-green-400/70 leading-relaxed">
            Mitochondria are known as the powerhouse of the cell, producing ATP
            through cellular respiration.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function AIQuizzesChar({ char, index }: { char: string; index: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isAnimating = useRef(false);

  const triggerBounce = () => {
    if (isAnimating.current || !ref.current) return;
    isAnimating.current = true;
    animate(
      ref.current,
      {
        y: [0, -6, 0],
        filter: ["brightness(1)", "brightness(1.4)", "brightness(1)"],
      },
      {
        delay: index * 0.04,
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
        onComplete: () => {
          isAnimating.current = false;
        },
      },
    );
  };

  return (
    <motion.span
      ref={ref}
      className="inline-block bg-gradient-to-r from-primary via-yellow-300 to-primary bg-clip-text text-transparent bg-[length:200%_100%]"
      initial={{ opacity: 0, y: 30, rotateX: -90 }}
      animate={{
        opacity: 1,
        y: 0,
        rotateX: 0,
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
      }}
      transition={{
        opacity: {
          delay: 0.45 + index * 0.04,
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1],
        },
        y: {
          delay: 0.45 + index * 0.04,
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1],
        },
        rotateX: {
          delay: 0.45 + index * 0.04,
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1],
        },
        backgroundPosition: {
          delay: 1.2,
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }}
      onMouseEnter={triggerBounce}
      style={{ cursor: "default" }}
    >
      {char === " " ? "\u00A0" : char}
    </motion.span>
  );
}

function AIQuizzesText() {
  const chars = "talk back".split("");
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const waveRunning = useRef(false);

  const triggerWave = () => {
    if (waveRunning.current) return;
    waveRunning.current = true;
    chars.forEach((_, i) => {
      const el = charRefs.current[i];
      if (!el) return;
      animate(
        el,
        {
          y: [0, -6, 0],
          filter: ["brightness(1)", "brightness(1.4)", "brightness(1)"],
        },
        {
          delay: i * 0.04,
          duration: 0.45,
          ease: [0.16, 1, 0.3, 1],
          onComplete: () => {
            if (i === chars.length - 1) waveRunning.current = false;
          },
        },
      );
    });
  };

  return (
    <span className="relative inline-block">
      <span className="relative cursor-default" onMouseEnter={triggerWave}>
        {chars.map((char, i) => (
          <motion.span
            key={i}
            ref={(el) => {
              charRefs.current[i] = el;
            }}
            className="inline-block bg-gradient-to-r from-primary via-yellow-300 to-primary bg-clip-text text-transparent bg-[length:200%_100%]"
            style={{ fontFamily: "'Zen Dots', cursive" }}
            initial={{ opacity: 0, y: 30, rotateX: -90 }}
            animate={{
              opacity: 1,
              y: 0,
              rotateX: 0,
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              opacity: {
                delay: 0.45 + i * 0.04,
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              },
              y: {
                delay: 0.45 + i * 0.04,
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              },
              rotateX: {
                delay: 0.45 + i * 0.04,
                duration: 0.5,
                ease: [0.16, 1, 0.3, 1],
              },
              backgroundPosition: {
                delay: 1.2,
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
        <motion.span
          className="absolute -inset-x-8 -inset-y-4 blur-2xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0.3, 0.4] }}
          transition={{ delay: 0.9, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(48 96% 53% / 0.18) 0%, transparent 70%)",
          }}
        />
        <motion.span
          className="absolute -inset-x-10 -inset-y-6 blur-3xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.15, 0.35, 0.15] }}
          transition={{
            delay: 1.2,
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(48 96% 53% / 0.12) 0%, transparent 70%)",
          }}
        />
      </span>
      <Doodle
        d={D.loopUnderline}
        color="text-primary/40"
        className="absolute -bottom-2 left-0 w-full h-3"
        viewBox="0 0 200 20"
        delay={1}
      />
    </span>
  );
}

function BeforeAfterSlider() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [circleSize, setCircleSize] = useState(0);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useMotionValue(0);
  const smoothY = useMotionValue(0);
  const targetSize = useRef(0);
  const currentSize = useRef(0);
  const rafRef = useRef<number>(0);
  const hasInteracted = useRef(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const hintTimer = setTimeout(() => {
      if (!hasInteracted.current) setShowHint(true);
    }, 2000);
    return () => clearTimeout(hintTimer);
  }, []);

  useEffect(() => {
    let active = true;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      if (!active) return;
      smoothX.set(lerp(smoothX.get(), mouseX.get(), 0.12));
      smoothY.set(lerp(smoothY.get(), mouseY.get(), 0.12));
      currentSize.current = lerp(currentSize.current, targetSize.current, 0.1);
      setCircleSize(currentSize.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const getRelativePos = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    hasInteracted.current = true;
    setShowHint(false);
    setIsRevealing(true);
    getRelativePos(e);
    smoothX.set(
      e.clientX - (containerRef.current?.getBoundingClientRect().left || 0),
    );
    smoothY.set(
      e.clientY - (containerRef.current?.getBoundingClientRect().top || 0),
    );
    targetSize.current = 280;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    getRelativePos(e);
    if (isRevealing) {
      targetSize.current = Math.min(400, targetSize.current + 0.5);
    }
  };

  const handlePointerUp = () => {
    setIsRevealing(false);
    targetSize.current = 0;
  };

  const clipPath =
    isRevealing || circleSize > 1
      ? `circle(${circleSize}px at ${smoothX.get()}px ${smoothY.get()}px)`
      : "circle(0px at 50% 50%)";

  return (
    <div className="relative w-full">
      <motion.div
        className="relative w-full h-[340px] sm:h-[400px] md:h-[440px] lg:h-[480px] overflow-hidden select-none touch-none"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ cursor: isRevealing ? "none" : "pointer" }}
        data-testid="slider-container"
      >
        <div className="absolute inset-0">
          <HandwrittenPaper />
        </div>

        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ clipPath }}
        >
          <div className="absolute inset-0">
            <PrepetualQuizPlayer />
          </div>
        </div>

        {(isRevealing || circleSize > 1) && (
          <svg
            className="absolute inset-0 z-20 pointer-events-none w-full h-full"
            style={{ overflow: "hidden" }}
          >
            <defs>
              <filter
                id="glowFilter"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="6"
                  result="blur1"
                />
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="14"
                  result="blur2"
                />
                <feMerge>
                  <feMergeNode in="blur2" />
                  <feMergeNode in="blur1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle
              cx={smoothX.get()}
              cy={smoothY.get()}
              r={circleSize}
              fill="none"
              stroke="rgba(250,204,21,0.6)"
              strokeWidth="2.5"
              filter="url(#glowFilter)"
            />
            <circle
              cx={smoothX.get()}
              cy={smoothY.get()}
              r={circleSize}
              fill="none"
              stroke="rgba(250,204,21,0.15)"
              strokeWidth="8"
              filter="url(#glowFilter)"
            />
          </svg>
        )}

        <AnimatePresence>
          {showHint && !isRevealing && circleSize < 1 && (
            <motion.div
              className="absolute z-20 left-1/2 top-[35%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                className="w-14 h-14 rounded-full bg-white/90 dark:bg-white/95 shadow-lg border border-gray-200/80 flex items-center justify-center"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <MousePointer2 className="w-5 h-5 text-gray-600" />
              </motion.div>
              <span className="text-[11px] font-medium text-white bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full tracking-wide">
                Click & hold to reveal
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="absolute bottom-0 left-0 right-0 h-[55%] pointer-events-none z-30"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, hsl(var(--background) / 0.15) 15%, hsl(var(--background) / 0.5) 35%, hsl(var(--background) / 0.8) 55%, hsl(var(--background)) 75%)",
          }}
        />
      </motion.div>
    </div>
  );
}

function HowItWorksGallery() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const stages = [
    {
      icon: Upload,
      label: "Upload",
      desc: "Drop your study materials - PDFs, images, Word docs, or PowerPoint files",
      color: "text-primary",
      bg: "bg-primary/10",
      borderColor: "border-primary/30",
      content: (
        <div className="text-center w-full">
          <motion.div
            className="w-28 h-28 mx-auto mb-5 rounded-2xl bg-primary/5 border-2 border-dashed border-primary/30 flex items-center justify-center relative overflow-hidden"
            whileHover={{ scale: 1.05, borderStyle: "solid" }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.div
              className="absolute inset-0 bg-primary/5"
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Upload className="w-12 h-12 text-primary" />
            </motion.div>
          </motion.div>
          <p className="text-base font-semibold text-foreground mb-3">
            Drop your study materials
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {["PDF", "Images", "Word", "PPT"].map((f, idx) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Badge variant="secondary" className="text-xs px-3 py-1.5">
                  {f}
                </Badge>
              </motion.div>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: Eye,
      label: "Extract",
      desc: "Our AI reads and analyzes your content instantly with precision",
      color: "text-primary",
      bg: "bg-primary/10",
      borderColor: "border-primary/30",
      content: (
        <div className="w-full max-w-sm mx-auto">
          <div className="space-y-3 mb-5">
            {[100, 85, 60].map((width, i) => (
              <motion.div
                key={i}
                className="h-3 bg-primary/20 rounded-full overflow-hidden"
                style={{ width: `${width}%` }}
              >
                <motion.div
                  className="h-full bg-primary/40 rounded-full"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              </motion.div>
            ))}
          </div>
          <motion.div
            className="flex items-center justify-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Eye className="w-5 h-5 text-primary" />
            </motion.div>
            <span className="text-sm font-medium text-primary">
              Analyzing your content...
            </span>
          </motion.div>
        </div>
      ),
    },
    {
      icon: Brain,
      label: "Generate",
      desc: "AI transforms your text into personalized quiz questions",
      color: "text-primary",
      bg: "bg-primary/10",
      borderColor: "border-primary/30",
      content: (
        <div className="w-full max-w-sm mx-auto space-y-3">
          {[
            {
              type: "Multiple Choice",
              q: "What is the main concept discussed?",
            },
            { type: "True/False", q: "This statement accurately reflects..." },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-left"
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: i * 0.2, type: "spring", stiffness: 200 }}
              whileHover={{ scale: 1.02 }}
            >
              <Badge
                variant="outline"
                className="mb-2 text-primary border-primary/30 text-xs bg-primary/10"
              >
                {item.type}
              </Badge>
              <p className="text-sm font-medium text-foreground">{item.q}</p>
            </motion.div>
          ))}
          <motion.div
            className="flex items-center justify-center gap-2 pt-2"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Brain className="w-4 h-4 text-primary" />
            </motion.div>
            <span className="text-sm text-primary">Generating more...</span>
          </motion.div>
        </div>
      ),
    },
    {
      icon: GraduationCap,
      label: "Learn",
      desc: "Master your subjects with interactive quizzes and flashcards",
      color: "text-primary",
      bg: "bg-primary/10",
      borderColor: "border-primary/30",
      content: (
        <div className="text-center w-full">
          <motion.div
            className="w-28 h-28 mx-auto mb-5 rounded-full bg-primary/10 flex items-center justify-center relative"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary/30"
              animate={{ scale: [1, 1.1, 1], opacity: [1, 0, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <CheckCheck className="w-12 h-12 text-primary" />
            </motion.div>
          </motion.div>
          <p className="text-base font-semibold text-foreground mb-4">
            Ready to learn!
          </p>
          <div className="flex justify-center gap-3">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Badge className="bg-primary/15 text-primary border border-primary/30 px-4 py-1.5 cursor-pointer">
                <Play className="w-3.5 h-3.5 mr-1.5" /> Take Quiz
              </Badge>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Badge
                variant="outline"
                className="border-primary/30 px-4 py-1.5 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Study
              </Badge>
            </motion.div>
          </div>
        </div>
      ),
    },
  ];

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollLeft = containerRef.current.scrollLeft;
    const width = containerRef.current.offsetWidth;
    const index = Math.round(scrollLeft / width);
    setActiveStep(index);
  };

  const goToStep = (index: number) => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      left: index * containerRef.current.offsetWidth,
      behavior: "smooth",
    });
  };

  const goNext = () => {
    if (activeStep < stages.length - 1) {
      goToStep(activeStep + 1);
    }
  };

  const goPrev = () => {
    if (activeStep > 0) {
      goToStep(activeStep - 1);
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted rounded-full overflow-hidden z-20">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: "25%" }}
          animate={{ width: `${((activeStep + 1) / stages.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>

      {/* Navigation arrows */}
      <AnimatePresence>
        {activeStep > 0 && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: isHovered ? 1 : 0.5, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={goPrev}
            className="absolute left-2 top-[40%] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            aria-label="Previous step"
            data-testid="button-carousel-prev"
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeStep < stages.length - 1 && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: isHovered ? 1 : 0.5, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={goNext}
            className="absolute right-2 top-[40%] -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            aria-label="Next step"
            data-testid="button-carousel-next"
          >
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-6 pb-8 pt-4"
        style={{ scrollBehavior: "smooth" }}
      >
        {stages.map((stage, i) => {
          const isActive = activeStep === i;

          return (
            <div key={stage.label} className="min-w-full snap-center px-4">
              <motion.div
                className="relative h-full"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: "spring", stiffness: 100 }}
              >
                <Card
                  className={`relative border-2 ${isActive ? stage.borderColor : "border-transparent"} bg-card overflow-visible h-full min-h-[420px] transition-all duration-500 group shadow-xl`}
                >
                  {/* Gradient background overlay */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${stage.bg} to-transparent opacity-30 pointer-events-none rounded-xl overflow-hidden`}
                  />

                  {/* Animated corner glow */}
                  <motion.div
                    className={`absolute -top-24 -right-24 w-48 h-48 rounded-full ${stage.bg} blur-3xl`}
                    animate={{
                      scale: isActive ? [1, 1.3, 1] : 1,
                      opacity: isActive ? [0.3, 0.5, 0.3] : 0.2,
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />

                  {/* Floating decorative elements */}
                  <motion.div
                    className={`absolute top-12 right-12 w-2 h-2 rounded-full ${stage.bg}`}
                    animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                  <motion.div
                    className={`absolute bottom-24 left-12 w-1.5 h-1.5 rounded-full ${stage.bg}`}
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                  />

                  <CardContent className="relative p-8 md:p-10 flex flex-col items-center justify-center text-center h-full z-10">
                    {/* Step indicator dot replaced with number */}
                    <motion.div
                      className="relative mb-8"
                      animate={isActive ? { y: [0, -6, 0] } : {}}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      {/* Glow ring */}
                      <motion.div
                        className={`absolute inset-0 rounded-full ${stage.bg} blur-xl`}
                        animate={
                          isActive
                            ? { scale: [1, 2, 1], opacity: [0.3, 0.6, 0.3] }
                            : {}
                        }
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <div
                        className={`relative w-12 h-12 rounded-full ${stage.bg} border-2 ${stage.borderColor} flex items-center justify-center text-xl font-bold shadow-lg ${stage.color}`}
                      >
                        {i + 1}
                      </div>
                    </motion.div>

                    {/* Title and description */}
                    <div className="mb-8">
                      <motion.h3
                        className={`text-2xl font-bold mb-3 ${stage.color}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        {stage.label}
                      </motion.h3>
                      <p className="text-muted-foreground max-w-md text-sm md:text-base leading-relaxed">
                        {stage.desc}
                      </p>
                    </div>

                    {/* Content area */}
                    <div className="flex-1 flex items-center justify-center w-full">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={stage.label}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="w-full"
                        >
                          {stage.content}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Step indicators */}
      <div className="flex justify-center items-center gap-3 mt-4">
        {stages.map((stage, i) => (
          <button
            key={i}
            onClick={() => goToStep(i)}
            className={`group relative flex items-center transition-all duration-300 ${
              activeStep === i
                ? "scale-110"
                : "scale-100 opacity-60 hover:opacity-100"
            }`}
            aria-label={`Go to step ${i + 1}: ${stage.label}`}
            data-testid={`button-step-indicator-${i}`}
          >
            <motion.div
              className={`rounded-full flex items-center justify-center transition-all duration-500 text-xs font-bold ${
                activeStep === i
                  ? `w-8 h-8 ${stage.bg} border-2 ${stage.borderColor} shadow-[0_0_10px_rgba(var(--primary),0.5)] ${stage.color}`
                  : "w-6 h-6 bg-muted border border-transparent text-muted-foreground/60"
              }`}
              animate={{
                scale: activeStep === i ? [1, 1.05, 1] : 1,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 20,
                scale: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                },
              }}
            >
              {i + 1}
            </motion.div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FeatureIllustration({
  feature,
  color,
}: {
  feature: string;
  color: string;
}) {
  const colorClasses: Record<
    string,
    { bg: string; text: string; border: string }
  > = {
    blue: {
      bg: "bg-blue-500",
      text: "text-blue-500",
      border: "border-blue-500/30",
    },
    purple: {
      bg: "bg-purple-500",
      text: "text-purple-500",
      border: "border-purple-500/30",
    },
    orange: {
      bg: "bg-orange-500",
      text: "text-orange-500",
      border: "border-orange-500/30",
    },
    rose: {
      bg: "bg-rose-500",
      text: "text-rose-500",
      border: "border-rose-500/30",
    },
    emerald: {
      bg: "bg-emerald-500",
      text: "text-emerald-500",
      border: "border-emerald-500/30",
    },
    amber: {
      bg: "bg-amber-500",
      text: "text-amber-500",
      border: "border-amber-500/30",
    },
    cyan: {
      bg: "bg-cyan-500",
      text: "text-cyan-500",
      border: "border-cyan-500/30",
    },
    indigo: {
      bg: "bg-indigo-500",
      text: "text-indigo-500",
      border: "border-indigo-500/30",
    },
  };
  const c = colorClasses[color] || colorClasses.blue;

  if (feature === "Multi-Format Upload") {
    return (
      <div className="w-full h-full flex items-center justify-center p-2 pointer-events-none">
        <div className="w-full max-w-[240px] transform scale-[0.85]">
          <Card className="border-2 border-dashed border-border/50 bg-card/50">
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Upload className={`w-5 h-5 ${c.text}`} />
              </div>
              <p className="text-[10px] font-medium text-foreground text-center">
                Upload your study material
              </p>
              <p className="text-[8px] text-muted-foreground text-center">
                Drag and drop or click
              </p>
              <div className="flex flex-wrap gap-1 justify-center mt-1">
                <Badge variant="secondary" className="text-[7px] px-1.5 py-0">
                  PDF
                </Badge>
                <Badge variant="secondary" className="text-[7px] px-1.5 py-0">
                  DOCX
                </Badge>
                <Badge variant="secondary" className="text-[7px] px-1.5 py-0">
                  PPTX
                </Badge>
                <Badge variant="secondary" className="text-[7px] px-1.5 py-0">
                  Images
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (feature === "AI Quiz Generation") {
    return (
      <div className="w-full h-full flex items-center justify-center p-2 pointer-events-none">
        <div className="w-full max-w-[240px] transform scale-[0.85]">
          <Card className="border bg-card">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={`${c.bg} text-white text-[8px] px-1.5`}>
                  Q3 / 10
                </Badge>
                <Badge variant="secondary" className="text-[7px] px-1.5">
                  Multiple Choice
                </Badge>
              </div>
              <div className="bg-muted/30 rounded-md p-2">
                <div className="h-1.5 bg-foreground/15 rounded w-3/4 mb-1" />
                <div className="h-1.5 bg-foreground/10 rounded w-1/2" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 p-1.5 rounded-md border border-border/50">
                  <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[7px] font-medium text-muted-foreground">
                    A
                  </div>
                  <div className="h-1.5 bg-foreground/10 rounded flex-1" />
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded-md border-2 border-green-500 bg-green-500/10">
                  <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-[7px] font-medium text-white">
                    B
                  </div>
                  <div className="h-1.5 bg-green-500/30 rounded flex-1" />
                  <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (feature === "Study Mode") {
    return (
      <div className="w-full h-full flex items-center justify-center p-2 pointer-events-none">
        <div className="relative w-full max-w-[200px] transform scale-[0.85]">
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 opacity-70">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
              <ArrowLeft className="w-3 h-3 text-muted-foreground" />
            </div>
            <span className="text-[6px] text-muted-foreground font-medium">
              Still
            </span>
            <span className="text-[6px] text-muted-foreground font-medium">
              Learning
            </span>
          </div>
          <Card className="border bg-card shadow-lg rotate-1">
            <CardContent className="p-3 flex flex-col items-center">
              <span
                className={`text-[7px] uppercase tracking-widest ${c.text} font-bold mb-2`}
              >
                Question
              </span>
              <div className="w-full space-y-1 mb-2">
                <div className="h-1.5 bg-foreground/12 rounded w-full" />
                <div className="h-1.5 bg-foreground/8 rounded w-3/4 mx-auto" />
              </div>
              <div className="w-full h-px bg-border my-2" />
              <span className="text-[8px] text-muted-foreground">
                tap to flip
              </span>
            </CardContent>
          </Card>
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 opacity-70">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <Check className="w-3 h-3 text-primary" />
            </div>
            <span className="text-[6px] text-primary font-medium">Know</span>
            <span className="text-[6px] text-primary font-medium">This</span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1">
            <div className="h-1 bg-muted rounded-full w-16">
              <div className={`h-1 ${c.bg} rounded-full w-3/5`} />
            </div>
            <span className="text-[7px] text-muted-foreground">3/5</span>
          </div>
        </div>
      </div>
    );
  }

  if (feature === "Spaced Repetition") {
    return (
      <div className="w-full h-full flex items-center justify-center p-2 pointer-events-none">
        <div className="w-full max-w-[240px] transform scale-[0.85]">
          <Card className="border bg-card">
            <CardContent className="p-3 space-y-2">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${c.bg} rounded-full w-2/3`} />
              </div>
              <p className="text-[8px] text-muted-foreground text-center">
                Revision Round 2 of 3
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-md border-2 border-green-500/30 bg-green-500/5 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-500">4</p>
                    <p className="text-[7px] text-green-600">correct</p>
                  </div>
                </div>
                <div
                  className={`p-2 rounded-md border-2 ${c.border} ${c.bg}/5 flex items-center gap-2`}
                >
                  <div
                    className={`w-5 h-5 rounded-full ${c.bg} flex items-center justify-center`}
                  >
                    <X className="w-3 h-3 text-white" />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${c.text}`}>2</p>
                    <p className={`text-[7px] ${c.text}`}>to retry</p>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                className={`w-full ${c.bg} hover:${c.bg}/90 text-white text-[9px] h-7 border-0`}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Retry Missed Questions
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (feature === "Community Sharing") {
    return (
      <div className="w-full h-full flex items-center justify-center p-2 pointer-events-none">
        <div className="w-full max-w-[240px] transform scale-[0.85]">
          <Card className="border bg-card">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-semibold">Biology Quiz</h4>
                <Badge variant="secondary" className="text-[7px] px-1.5">
                  10 questions
                </Badge>
              </div>
              <div className="bg-muted/30 rounded-md p-2 space-y-1">
                <div className="h-1 bg-foreground/10 rounded w-full" />
                <div className="h-1 bg-foreground/8 rounded w-3/4" />
                <div className="h-1 bg-foreground/6 rounded w-1/2" />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className={`flex-1 ${c.bg} hover:${c.bg}/90 text-white text-[9px] h-7 border-0`}
                >
                  <Share2 className="w-3 h-3 mr-1" />
                  Share
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={`flex-1 text-[9px] h-7 ${c.border} ${c.text}`}
                >
                  Copy link
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (feature === "Pip AI Assistant") {
    return (
      <div className="w-full h-full flex items-center justify-center p-2 pointer-events-none">
        <div className="w-full max-w-[260px] transform scale-[0.8]">
          <Card className="border bg-card">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-100 to-cyan-200 dark:from-cyan-900 dark:to-cyan-800 flex items-center justify-center shrink-0">
                  <span className="text-lg">🐧</span>
                </div>
                <div className="flex-1 space-y-2">
                  <div
                    className={`p-2 rounded-lg ${c.bg}/10 border ${c.border}`}
                  >
                    <div className="space-y-1">
                      <div className={`h-1.5 ${c.bg}/40 rounded w-full`} />
                      <div className={`h-1.5 ${c.bg}/30 rounded w-4/5`} />
                      <div className={`h-1.5 ${c.bg}/20 rounded w-3/5`} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      variant="outline"
                      className={`text-[7px] px-1.5 ${c.border} ${c.text}`}
                    >
                      Explain this
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[7px] px-1.5 ${c.border} ${c.text}`}
                    >
                      Give a hint
                    </Badge>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                className={`w-full mt-2 ${c.bg} hover:${c.bg}/90 text-white text-[9px] h-7 border-0`}
              >
                <MessageCircle className="w-3 h-3 mr-1" />
                Ask Pip
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (feature === "Progress Tracking") {
    return (
      <div className="w-full h-full flex items-center justify-center p-2 pointer-events-none">
        <div className="w-full max-w-[260px] transform scale-[0.8]">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5">
              <Card className="bg-primary border-0">
                <CardContent className="p-2 text-center">
                  <p className="text-[7px] text-primary-foreground/80">
                    Quizzes
                  </p>
                  <p className="text-sm font-bold text-primary-foreground">
                    12
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-primary/80 border-0">
                <CardContent className="p-2 text-center">
                  <p className="text-[7px] text-primary-foreground/80">
                    Score
                  </p>
                  <p className="text-sm font-bold text-primary-foreground">92%</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/60 border-0">
                <CardContent className="p-2 text-center">
                  <p className="text-[7px] text-primary-foreground/80">
                    Accuracy
                  </p>
                  <p className="text-sm font-bold text-primary-foreground">
                    85%
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card className="border bg-card">
              <CardContent className="p-2">
                <p className="text-[8px] font-medium text-muted-foreground mb-2">
                  Weekly Progress
                </p>
                <div className="flex items-end justify-between gap-1 h-10">
                  {[35, 48, 32, 58, 42, 52, 30].map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 ${c.bg} rounded-t`}
                      style={{ height: `${h}%`, opacity: 0.5 + i * 0.07 }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <span
                      key={i}
                      className="text-[6px] text-muted-foreground flex-1 text-center"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function FeatureShowcase() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const features = [
    {
      icon: Upload,
      title: "Multi-Format Upload",
      description: "PDFs, images, Word, Excel supported.",
      color: "blue",
      details:
        "Upload any document format and our intelligent parser extracts the text content. For images and scanned documents, our OCR (Optical Character Recognition) technology accurately reads text from photos of textbooks, handwritten notes, and more.",
    },
    {
      icon: Brain,
      title: "AI Quiz Generation",
      description: "AI creates meaningful questions.",
      color: "purple",
      details:
        "Our AI analyzes your content to generate diverse question types: multiple choice, true/false, and short answer. Questions are designed to test comprehension, not just memorization, with adjustable difficulty levels.",
    },
    {
      icon: BookOpen,
      title: "Study Mode",
      description: "Flashcards with progress tracking.",
      color: "orange",
      details:
        "Flip through questions as flashcards. Mark each card as 'known' or 'still learning' to track your progress. Cards you're still learning will appear more frequently until you master them.",
    },
    {
      icon: RotateCcw,
      title: "Spaced Repetition",
      description: "Retry missed questions until mastered.",
      color: "rose",
      details:
        "Questions you answer incorrectly automatically appear in retry rounds. This spaced repetition approach ensures you keep practicing difficult concepts until they stick, maximizing long-term retention.",
    },
    {
      icon: Share2,
      title: "Community Sharing",
      description: "Share and discover public quizzes.",
      color: "emerald",
      details:
        "Share your quizzes with friends or make them public for others to use. Discover quizzes created by the community, sorted by subject and popularity. Collaborate and learn together.",
    },
    {
      icon: MessageCircle,
      title: "Pip AI Assistant",
      description: "Your personal study companion.",
      color: "cyan",
      details:
        "Meet Pip, your friendly arctic study buddy! Pip understands your quiz context and helps explain difficult concepts, provides hints when you're stuck, and supports math formulas. Pip guides you to the answer without giving it away.",
    },
    {
      icon: Target,
      title: "Progress Tracking",
      description: "Monitor your exam readiness.",
      color: "indigo",
      details:
        "Track your accuracy and quiz history all in one dashboard. See which topics need more practice and watch your scores improve over time as you prepare for your exams.",
    },
  ];

  const colorClasses: Record<
    string,
    { text: string; border: string; bg: string; glow: string; solidBg: string }
  > = {
    blue: {
      text: "text-blue-500",
      border: "border-blue-500/20",
      bg: "bg-blue-500/10",
      glow: "group-hover:shadow-blue-500/20",
      solidBg: "bg-blue-500",
    },
    purple: {
      text: "text-purple-500",
      border: "border-purple-500/20",
      bg: "bg-purple-500/10",
      glow: "group-hover:shadow-purple-500/20",
      solidBg: "bg-purple-500",
    },
    orange: {
      text: "text-orange-500",
      border: "border-orange-500/20",
      bg: "bg-orange-500/10",
      glow: "group-hover:shadow-orange-500/20",
      solidBg: "bg-orange-500",
    },
    rose: {
      text: "text-rose-500",
      border: "border-rose-500/20",
      bg: "bg-rose-500/10",
      glow: "group-hover:shadow-rose-500/20",
      solidBg: "bg-rose-500",
    },
    emerald: {
      text: "text-emerald-500",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/10",
      glow: "group-hover:shadow-emerald-500/20",
      solidBg: "bg-emerald-500",
    },
    amber: {
      text: "text-amber-500",
      border: "border-amber-500/20",
      bg: "bg-amber-500/10",
      glow: "group-hover:shadow-amber-500/20",
      solidBg: "bg-amber-500",
    },
    cyan: {
      text: "text-cyan-500",
      border: "border-cyan-500/20",
      bg: "bg-cyan-500/10",
      glow: "group-hover:shadow-cyan-500/20",
      solidBg: "bg-cyan-500",
    },
    indigo: {
      text: "text-indigo-500",
      border: "border-indigo-500/20",
      bg: "bg-indigo-500/10",
      glow: "group-hover:shadow-indigo-500/20",
      solidBg: "bg-indigo-500",
    },
  };

  return (
    <motion.div className="relative" layout>
      <AnimatePresence mode="wait">
        {expandedIndex === null ? (
          <motion.div
            key="grid"
            className="grid gap-4 sm:gap-5"
            style={{
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            layout
          >
            {features.map((feature, index) => {
              const colors = colorClasses[feature.color];
              const entrances = [
                {
                  initial: { opacity: 0, y: 30, filter: "blur(6px)" },
                  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                },
                {
                  initial: { opacity: 0, scale: 0.85, filter: "blur(4px)" },
                  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                },
                {
                  initial: { opacity: 0, x: -25, filter: "blur(4px)" },
                  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                },
                {
                  initial: { opacity: 0, y: 25, rotateX: -10 },
                  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                },
                {
                  initial: { opacity: 0, x: 25, filter: "blur(4px)" },
                  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                },
                {
                  initial: { opacity: 0, scale: 0.8, rotate: -3 },
                  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                },
                {
                  initial: { opacity: 0, y: -20, filter: "blur(6px)" },
                  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                },
                {
                  initial: { opacity: 0, scale: 0.9, filter: "blur(8px)" },
                  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                },
              ];
              const entrance = entrances[index % entrances.length];
              return (
                <motion.div
                  key={feature.title}
                  initial={entrance.initial}
                  whileInView={{
                    opacity: 1,
                    y: 0,
                    x: 0,
                    scale: 1,
                    rotate: 0,
                    rotateX: 0,
                    filter: "blur(0px)",
                  }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: index * 0.06, ...entrance.transition }}
                  onClick={() => setExpandedIndex(index)}
                  className="flex"
                >
                  <Card
                    className={`w-full group cursor-pointer transition-all duration-300 border ${colors.border} bg-card hover:shadow-xl ${colors.glow} hover:-translate-y-1 relative overflow-visible`}
                  >
                    <CardContent className="p-4 flex flex-col h-full">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center border ${colors.border} shrink-0`}
                        >
                          <feature.icon className={`w-5 h-5 ${colors.text}`} />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-tight">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="w-full"
          >
            {(() => {
              const feature = features[expandedIndex];
              const colors = colorClasses[feature.color];
              return (
                <Card
                  className={`w-full border-2 ${colors.border} bg-card shadow-2xl relative overflow-visible`}
                >
                  <CardContent className="p-8 relative overflow-hidden">
                    <div
                      className={`absolute -top-20 -right-20 w-64 h-64 rounded-full ${colors.bg} blur-3xl opacity-50`}
                    />
                    <div
                      className={`absolute -bottom-20 -left-20 w-48 h-48 rounded-full ${colors.bg} blur-3xl opacity-30`}
                    />

                    <div className="relative grid md:grid-cols-2 gap-8 items-center">
                      <div className="order-2 md:order-1">
                        <motion.div
                          className={`inline-flex w-16 h-16 rounded-2xl ${colors.bg} items-center justify-center mb-6 border ${colors.border}`}
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 200,
                            delay: 0.1,
                          }}
                        >
                          <feature.icon className={`w-8 h-8 ${colors.text}`} />
                        </motion.div>

                        <motion.h3
                          className="text-2xl md:text-3xl font-bold text-foreground mb-4"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.15 }}
                        >
                          {feature.title}
                        </motion.h3>

                        <motion.p
                          className="text-base text-muted-foreground leading-relaxed mb-6"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          {feature.details}
                        </motion.p>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.25 }}
                        >
                          <Button
                            variant="outline"
                            onClick={() => setExpandedIndex(null)}
                            className="gap-2"
                            data-testid="button-feature-back"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Back to all features
                          </Button>
                        </motion.div>
                      </div>

                      <motion.div
                        className="order-1 md:order-2 flex items-center justify-center"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 100,
                          delay: 0.1,
                        }}
                      >
                        <div
                          className={`w-full max-w-[320px] aspect-[4/3] rounded-2xl ${colors.bg} border ${colors.border} p-4 flex items-center justify-center`}
                        >
                          <FeatureIllustration
                            feature={feature.title}
                            color={feature.color}
                          />
                        </div>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ParsingShowcase() {
  const originalQuestions = [
    {
      num: "1",
      question: "What is the powerhouse of the cell?",
      options: ["A) Nucleus", "B) Mitochondria", "C) Ribosome", "D) Golgi apparatus"],
    },
    {
      num: "2",
      question: "DNA replication occurs during which phase?",
      options: ["A) G1 phase", "B) S phase", "C) G2 phase", "D) M phase"],
    },
    {
      num: "3",
      question: "Photosynthesis takes place in the chloroplast.",
      options: ["True", "False"],
    },
  ];

  const convertedQuestions = [
    {
      num: "1",
      question: "What is the powerhouse of the cell?",
      options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi apparatus"],
      correct: 1,
      type: "multiple_choice" as const,
      explanation: "Mitochondria generate most of the cell's ATP through oxidative phosphorylation.",
    },
    {
      num: "2",
      question: "DNA replication occurs during which phase?",
      options: ["G1 phase", "S phase", "G2 phase", "M phase"],
      correct: 1,
      type: "multiple_choice" as const,
      explanation: "The S (synthesis) phase is when DNA is replicated before cell division.",
    },
    {
      num: "3",
      question: "Photosynthesis takes place in the chloroplast.",
      options: ["True", "False"],
      correct: 0,
      type: "true_false" as const,
      explanation: "Chloroplasts contain chlorophyll and are the site of photosynthesis in plant cells.",
    },
  ];

  const [phase, setPhase] = useState<"source" | "converting" | "result">("source");
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    const cycle = () => {
      setPhase("source");
      setActiveQuestion(0);
      setShowExplanation(false);

      setTimeout(() => setPhase("converting"), 2500);
      setTimeout(() => setPhase("result"), 4500);
      setTimeout(() => { setActiveQuestion(0); setShowExplanation(true); }, 5500);
      setTimeout(() => setActiveQuestion(1), 7000);
      setTimeout(() => setActiveQuestion(2), 8500);
    };
    cycle();
    const interval = setInterval(cycle, 11000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-[150px]"
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="container relative mx-auto px-4 sm:px-6 max-w-6xl">
        <div className="text-center mb-14 md:mb-20">
          <motion.div
            className="text-sm font-medium text-primary uppercase tracking-wider mb-3"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            
            Import your own questions
          </motion.div>
          <div className="overflow-hidden">
            <motion.h2
              className="text-3xl md:text-5xl font-bold text-foreground mb-5 leading-tight"
              initial={{ y: "120%" }}
              whileInView={{ y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
            >
              Your exam, made interactive
            </motion.h2>
          </div>
          <motion.p
            className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            whileInView={{ opacity: 1, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          >
            Upload an existing exam or worksheet and we'll convert it into a fully interactive quiz. 
            Every question stays exactly as written — nothing is invented, nothing is changed.
          </motion.p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 md:gap-8 items-start">
          <motion.div
            initial={{ opacity: 0, x: -40, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Original Exam Paper</span>
            </div>
            <Card className="relative overflow-visible" data-testid="card-source-exam">
              <CardContent className="p-5 md:p-7">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" data-testid="text-source-filename">Biology_Midterm_Exam.pdf</p>
                    <p className="text-xs text-muted-foreground">3 questions detected</p>
                  </div>
                </div>

                <div className="space-y-5">
                  {originalQuestions.map((q, qi) => (
                    <motion.div
                      key={qi}
                      className="space-y-2"
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: qi * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <p className="text-sm font-medium text-foreground">
                        <span className="text-muted-foreground mr-1">{q.num}.</span>
                        {q.question}
                      </p>
                      <div className={`grid ${q.options.length === 2 ? "grid-cols-2" : "grid-cols-2"} gap-1.5 pl-4`}>
                        {q.options.map((opt, oi) => (
                          <span key={oi} className="text-xs text-muted-foreground">{opt}</span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <AnimatePresence>
                  {phase === "converting" && (
                    <motion.div
                      className="absolute inset-0 rounded-xl bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.div
                        className="relative w-14 h-14"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      >
                        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent" />
                      </motion.div>
                      <motion.p
                        className="text-sm font-medium text-foreground"
                        animate={{ opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        AI reading questions...
                      </motion.p>
                      <p className="text-xs text-muted-foreground">Identifying correct answers</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            <motion.div
              className="mt-5 space-y-3"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
                <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-foreground">100% faithful to the original</p>
                  <p className="text-xs text-muted-foreground">Questions are extracted word-for-word. No content is generated or modified.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/50">
                <Brain className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-foreground">AI identifies correct answers</p>
                  <p className="text-xs text-muted-foreground">Uses knowledge to determine the right answer and explain why each option is correct or incorrect.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40, filter: "blur(8px)" }}
            whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <AnimatePresence mode="wait">
                {phase === "result" ? (
                  <motion.div
                    key="ready"
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <ClipboardCheck className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary uppercase tracking-wider">Interactive Quiz Ready</span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="converting"
                    className="flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Converted Quiz</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Card className={`relative overflow-visible transition-all duration-700 ${phase === "result" ? "border-primary/20" : ""}`} data-testid="card-converted-quiz">
              {phase === "result" && (
                <div className="absolute -inset-px rounded-xl bg-gradient-to-br from-primary/15 via-transparent to-primary/10 pointer-events-none" />
              )}
              <CardContent className="p-5 md:p-7 relative">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/50">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Import className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">Biology Midterm Exam</p>
                    <p className="text-xs text-muted-foreground">3 questions &middot; Multiple choice &middot; True/False</p>
                  </div>
                  <div className={`transition-opacity duration-300 ${phase === "result" ? "opacity-100" : "opacity-0"}`}>
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/25 bg-primary/5">
                      Imported
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  {convertedQuestions.map((q, qi) => {
                    const isHighlighted = phase === "result" && qi === activeQuestion;
                    return (
                      <motion.div
                        key={qi}
                        className={`p-3 rounded-lg border transition-all duration-500 ${
                          isHighlighted
                            ? "border-primary/25 bg-primary/5"
                            : "border-transparent bg-transparent"
                        }`}
                        animate={phase === "result" ? { opacity: 1 } : { opacity: 0.4 }}
                        transition={{ duration: 0.4 }}
                        data-testid={`card-converted-question-${qi}`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={`text-[10px] ${
                            q.type === "true_false"
                              ? "text-emerald-500 dark:text-emerald-400 border-emerald-500/25 bg-emerald-500/5"
                              : "text-blue-500 dark:text-blue-400 border-blue-500/25 bg-blue-500/5"
                          }`}>
                            {q.type === "true_false" ? "True/False" : "Multiple Choice"}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground mb-2">{q.question}</p>

                        <div className={`grid ${q.options.length === 2 ? "grid-cols-2" : "grid-cols-1"} gap-1.5`}>
                          {q.options.map((opt, oi) => (
                            <div
                              key={oi}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all duration-300 ${
                                isHighlighted && showExplanation && oi === q.correct
                                  ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                                  : isHighlighted && showExplanation
                                    ? "bg-muted/50 text-muted-foreground border border-transparent"
                                    : "text-muted-foreground border border-transparent"
                              }`}
                            >
                              {isHighlighted && showExplanation && oi === q.correct ? (
                                <Check className="w-3 h-3 shrink-0" />
                              ) : (
                                <CircleDot className="w-3 h-3 shrink-0 opacity-40" />
                              )}
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>

                        <div
                          className={`mt-2 flex items-start gap-2 p-2 rounded-md bg-primary/5 border border-primary/10 transition-opacity duration-300 ${
                            isHighlighted && showExplanation ? "opacity-100" : "opacity-0"
                          }`}
                        >
                          <Lightbulb className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                <div
                  className={`flex items-center justify-between gap-2 pt-4 mt-4 border-t border-border/50 transition-opacity duration-400 ${
                    phase === "result" ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-import-status">
                    <Check className="w-3.5 h-3.5 text-primary" />
                    <span>All answers verified by AI</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Play className="w-3 h-3" />
                    <span>Ready to practice</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
          className="mt-12 flex items-center justify-center gap-6 flex-wrap"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {[
            { icon: FileText, text: "PDFs" },
            { icon: Image, text: "Scanned exams" },
            { icon: File, text: "Word docs" },
            { icon: Layers, text: "Presentations" },
            { icon: Eye, text: "Handwritten notes" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <item.icon className="w-3.5 h-3.5 text-primary/70" />
              <span>{item.text}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function AnimatedCounter({
  value,
  duration = 2,
}: {
  value: string;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState("0");
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!isInView) return;

    if (value === "∞" || value === "100%") {
      setDisplayValue(value);
      return;
    }

    const numericValue = parseInt(value.replace(/[^0-9]/g, ""));
    const suffix = value.replace(/[0-9]/g, "");

    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(numericValue * easeOutQuart);
      setDisplayValue(current + suffix);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, value, duration]);

  return <div ref={ref}>{displayValue}</div>;
}

function StatsSection() {
  const stats = [
    { value: "100%", label: "Free Forever", icon: Star },
    { value: "5+", label: "File Formats", icon: FileText },
    { value: "∞", label: "Unlimited Quizzes", icon: Layers },
  ];

  return (
    <div className="flex flex-wrap justify-center gap-12 md:gap-20 max-w-3xl mx-auto">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, scale: 0.7, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          viewport={{ once: true }}
          transition={{
            delay: index * 0.12,
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <motion.div
              initial={{ rotate: -180, scale: 0 }}
              whileInView={{ rotate: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{
                delay: 0.1 + index * 0.12,
                type: "spring",
                stiffness: 200,
                damping: 12,
              }}
            >
              <stat.icon className="w-5 h-5 text-primary" />
            </motion.div>
            <span className="text-3xl md:text-4xl font-bold text-foreground">
              <AnimatedCounter value={stat.value} />
            </span>
          </div>
          <motion.div
            className="text-sm text-muted-foreground"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              delay: 0.2 + index * 0.12,
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {stat.label}
          </motion.div>
        </motion.div>
      ))}
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { extractedText, setExtractedText } = useQuiz();
  const { isAuthenticated, isLoading } = useAuth();
  const { openLoginDialog, openSignUpDialog } = useAuthDialog();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  useEffect(() => {
    setExtractedText("");
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleTextExtracted = (
    text: string,
    isOfficeWithImages?: boolean,
    documentImages?: string[],
  ) => {
    setExtractedText(text);
  };

  const handleContinueToGenerate = () => {
    if (isAuthenticated) {
      setLocation("/generate");
    } else {
      openLoginDialog();
    }
  };

  const handleGetStarted = () => {
    openSignUpDialog();
  };

  return (
    <div className="min-h-screen overflow-hidden">
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-3 sm:px-4 pointer-events-none">
        <div className="flex items-center justify-between gap-4 h-14 px-6 rounded-full border border-border/20 bg-background/50 backdrop-blur-md shadow-sm max-w-6xl w-full pointer-events-auto">
          <Link href="/" className="flex items-center gap-2.5" data-testid="link-logo">
            <img 
              src={logoImage} 
              alt="Prepetual Logo" 
              className="w-9 h-9 rounded-full object-cover"
            />
            <span className="pb-0.5 text-xl font-brand text-foreground hidden sm:inline">prepetual</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!isLoading && (
              <>
                <Button variant="ghost" onClick={openLoginDialog} data-testid="button-login">
                  Log in
                </Button>
                <Button variant="default" onClick={openSignUpDialog} data-testid="button-signup">
                  Sign up
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <section className="relative pb-8 md:pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <motion.div
            className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]"
            animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-0 -left-40 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[100px]"
            animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 1,
              backgroundPositionY: ["0px", "-80px"]
            }}
            transition={{ 
              opacity: { duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] },
              backgroundPositionY: { duration: 8, repeat: Infinity, ease: "linear" }
            }}
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(48 96% 53% / 0.07) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(48 96% 53% / 0.07) 1px, transparent 1px)
              `,
              backgroundSize: "80px 80px",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, black 35%, black 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, black 35%, black 100%)",
            }}
          />
        </div>

        <div className="w-full relative z-0">
          <BeforeAfterSlider />
        </div>

        <div className="container relative mx-auto px-4 sm:px-6 max-w-5xl">
          <div className="flex flex-col items-center">
            <div className="text-center max-w-4xl mx-auto -mt-24 sm:-mt-28 md:-mt-34 lg:-mt-40 relative z-10">
              <motion.div
                className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 1.5 }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(48_96%_53%/0.08)_0%,transparent_70%)]" />
              </motion.div>

              {[
                { x: "15%", y: "10%", size: 4, delay: 0.5, dur: 6 },
                { x: "80%", y: "20%", size: 3, delay: 1.2, dur: 8 },
                { x: "25%", y: "75%", size: 3, delay: 0.8, dur: 7 },
                { x: "70%", y: "65%", size: 5, delay: 1.5, dur: 9 },
                { x: "50%", y: "5%", size: 3, delay: 2.0, dur: 7 },
                { x: "90%", y: "50%", size: 4, delay: 0.3, dur: 8 },
              ].map((p, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    left: p.x,
                    top: p.y,
                    width: p.size,
                    height: p.size,
                    background: "hsl(48 96% 53% / 0.5)",
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 0.8, 0.3, 0.8, 0],
                    scale: [0.5, 1.2, 0.8, 1.2, 0.5],
                    y: [0, -12, -6, -14, 0],
                  }}
                  transition={{
                    delay: p.delay,
                    duration: p.dur,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}

              {/* className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-6 overflow-hidden"
                initial={{ opacity: 0, scale: 0.6, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              > */}
              {/* <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(90deg, transparent 0%, hsl(48 96% 53% / 0.15) 50%, transparent 100%)", width: "200%", left: "-100%" }}
                  animate={{ left: ["−100%", "100%"] }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
                />
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Sparkles className="h-4 w-4" />
                </motion.div> */}

              <h1
                className="font-bold text-foreground mb-5 leading-[1.1] tracking-tight relative text-center w-full"
                style={{ fontSize: "clamp(2.5rem, 6vw, 6rem)" }}
              >
                <span className="overflow-hidden inline-flex justify-center flex-wrap w-full">
                  {["Make", "your", "materials"].map((word, i) => (
                    <motion.span
                      key={word}
                      className="inline-block"
                      initial={{ y: "110%", opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        delay: 0.15 + i * 0.07,
                        duration: 0.7,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      {word}
                      {"\u00A0"}
                    </motion.span>
                  ))}
                </span>
                <AIQuizzesText />
              </h1>

              <motion.p
                className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto mb-7 leading-relaxed"
                initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  delay: 0.55,
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                Let every definition respond to you.
                <br/>
                Stay connected to what you learn.
              </motion.p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5 relative">
                <motion.div
                  className="relative"
                  initial={{ y: "120%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{
                    delay: 0.6,
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <motion.div
                    className="absolute -inset-2 rounded-xl bg-gradient-to-r from-primary/60 via-yellow-400/40 to-primary/60 blur-xl pointer-events-none"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <div className="relative group/btn">
                    <motion.div
                      className="absolute -inset-0.5 bg-gradient-to-r from-yellow-400 to-primary rounded-lg blur opacity-0 group-hover/btn:opacity-100 transition duration-500 pointer-events-none"
                      initial={false}
                    />
                    <Button
                      size="lg"
                      onClick={handleGetStarted}
                      className="gap-2.5 px-8 text-base h-13 w-full sm:w-auto shadow-lg shadow-primary/20 font-semibold relative overflow-hidden transition-shadow duration-300 group-hover/btn:shadow-primary/40"
                      data-testid="button-hero-get-started"
                    >
                      <span className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                      <span className="relative z-10 flex items-center gap-2.5">
                        Get Started
                        <span className = "font-light">
                          —it's free
                        </span>
                        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" />
                      </span>
                    </Button>
                    <span
                      className="absolute inset-0 rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500 pointer-events-none"
                      style={{
                        boxShadow:
                          "inset 0 1px 0 0 rgba(255,255,255,0.15), inset 0 -1px 0 0 rgba(0,0,0,0.1)",
                      }}
                    />
                  </div>
                </motion.div>
                <motion.div
                  whileTap={{ scale: 0.97 }}
                  initial={{ opacity: 0, x: -20, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  transition={{
                    delay: 0.75,
                    duration: 0.5,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="relative group"
                >
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={() =>
                      document
                        .getElementById("how-it-works")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="gap-2 w-full sm:w-auto h-13 text-base font-medium text-muted-foreground hover:text-foreground transition-all duration-300 group-hover:bg-primary/5"
                    data-testid="button-hero-learn-more"
                  >
                    <ArrowDown className="h-4 w-4 group-hover:translate-y-1 transition-transform" />
                    How It Works
                  </Button>
                </motion.div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                {[
                  { icon: CheckCircle2, text: "Free forever" },
                  { icon: CheckCircle2, text: "No credit card" },
                  { icon: CheckCircle2, text: "PDF, Word, Images" },
                ].map((item, i) => (
                  <motion.div
                    key={item.text}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground"
                    initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{
                      delay: 0.85 + i * 0.1,
                      duration: 0.5,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        delay: 0.95 + i * 0.1,
                        type: "spring",
                        stiffness: 300,
                        damping: 15,
                      }}
                    >
                      <item.icon className="h-4 w-4 text-primary flex-shrink-0" />
                    </motion.div>
                    <span>{item.text}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-16 md:py-20 border-y border-border/50">
        <div className="container mx-auto px-4 sm:px-6">
          <StatsSection />
        </div>
      </section>

      <section id="how-it-works" className="py-20 md:py-28">
        <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
          <div className="text-center mb-16">
            <motion.p
              className="text-sm font-medium text-primary uppercase tracking-wider mb-3"
              initial={{ opacity: 0, letterSpacing: "0em" }}
              whileInView={{ opacity: 1, letterSpacing: "0.1em" }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              Simple Process
            </motion.p>
            <div className="overflow-hidden">
              <motion.h2
                className="text-3xl md:text-4xl font-bold text-foreground mb-4"
                initial={{ y: "110%" }}
                whileInView={{ y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.05,
                }}
              >
                How It Works
              </motion.h2>
            </div>
            <motion.p
              className="text-muted-foreground max-w-lg mx-auto"
              initial={{ opacity: 0, filter: "blur(6px)" }}
              whileInView={{ opacity: 1, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.15,
              }}
            >
              From notes to quizzes in just a few clicks
            </motion.p>
          </div>

          <HowItWorksGallery />
        </div>
      </section>

      <ParsingShowcase />

      <section className="py-20 md:py-28 bg-muted/40 min-h-[800px] md:min-h-[650px]">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <motion.p
              className="text-sm font-medium text-primary uppercase tracking-wider mb-3"
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              Features
            </motion.p>
            <motion.h2
              className="text-3xl md:text-4xl font-bold text-foreground mb-4"
              initial={{ opacity: 0, x: -40, filter: "blur(6px)" }}
              whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.05,
              }}
            >
              Everything You Need
            </motion.h2>
            <motion.p
              className="text-muted-foreground max-w-lg mx-auto"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.15,
              }}
            >
              Powerful tools to transform how you study
            </motion.p>
          </div>

          <div className="max-w-5xl mx-auto">
            <FeatureShowcase />
          </div>
        </div>
      </section>
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="container relative mx-auto px-4 sm:px-6 max-w-3xl">
          <div className="text-center mb-10">
            <motion.p
              className="text-sm font-medium text-primary uppercase tracking-wider mb-3"
              initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              Try It Now
            </motion.p>
            <div className="overflow-hidden">
              <motion.h2
                className="text-3xl md:text-4xl font-bold text-foreground mb-4"
                initial={{ y: "120%", rotateX: -15 }}
                whileInView={{ y: 0, rotateX: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.05,
                }}
              >
                Create Your First Quiz
              </motion.h2>
            </div>
            <motion.p
              className="text-muted-foreground max-w-md mx-auto"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              whileInView={{ opacity: 1, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.15,
              }}
            >
              Upload any study material and watch AI turn it into practice
              questions
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="max-w-2xl mx-auto"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-primary/10 to-primary/30 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Card className="relative shadow-2xl border-primary/20 overflow-hidden bg-card/95 backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
                <CardContent className="p-8 relative">
                  <FileUpload onTextExtracted={handleTextExtracted} />

                  {extractedText && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6"
                    >
                      <Button
                        size="lg"
                        onClick={handleContinueToGenerate}
                        className="w-full gap-2 h-12 shadow-lg shadow-primary/20"
                        data-testid="button-continue-generate"
                      >
                        Continue to Generate Quiz
                        <ArrowRight className="h-5 w-5" />
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>
      </section>
      <section className="py-20 md:py-28 bg-muted/40 border-t border-border/50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto">
            <div className="overflow-hidden">
              <motion.h2
                className="text-3xl md:text-4xl font-bold text-foreground mb-4"
                initial={{ y: "120%" }}
                whileInView={{ y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                Ready to ace your exams?
              </motion.h2>
            </div>
            <motion.p
              className="text-muted-foreground mb-8"
              initial={{ opacity: 0, y: 12, filter: "blur(5px)" }}
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.1,
              }}
            >
              Start creating personalized practice quizzes from your study
              materials today.
            </motion.p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 relative z-10">
              <div className="relative">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.15,
                  }}
                  className="relative z-30"
                >
                  <Button
                    size="lg"
                    onClick={handleGetStarted}
                    className="gap-2 px-8 h-12 w-full sm:w-auto shadow-lg shadow-primary/20 transition-all duration-300 hover:shadow-primary/40 hover:-translate-y-1 active:translate-y-0 relative z-40"
                    data-testid="button-cta-get-started"
                  >
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
              <Link href="/about">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, x: -15, filter: "blur(4px)" }}
                  whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.5,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.25,
                  }}
                  className="relative z-20"
                >
                  <Button
                    size="lg"
                    variant="ghost"
                    className="gap-2 w-full sm:w-auto h-12 text-muted-foreground hover:text-foreground relative z-30"
                    data-testid="button-learn-more"
                  >
                    Learn More
                  </Button>
                </motion.div>
              </Link>
            </div>
          </div>
        </div>
      </section>
      {/* Scroll to top button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-6 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center z-50 hover:scale-110 active:scale-95 transition-transform"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            whileHover={{ y: -2 }}
            data-testid="button-scroll-to-top"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
      <Footer />
    </div>
  );
}

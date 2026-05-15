import React from "react";
import { cn } from "@/utils/cn";

type CardContextValue = {
  registerBody: (element: HTMLElement | null) => void;
};

const CardContext = React.createContext<CardContextValue | null>(null);

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContainer({ children, className }: CardContainerProps) {
  const bodyRef = React.useRef<HTMLElement | null>(null);

  const registerBody = React.useCallback((element: HTMLElement | null) => {
    bodyRef.current = element;
  }, []);

  const handleMouseMove = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    const rect = body.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const rotateY = ((offsetX - rect.width / 2) / rect.width) * 10;
    const rotateX = -((offsetY - rect.height / 2) / rect.height) * 8;

    body.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
  }, []);

  const resetTransform = React.useCallback(() => {
    if (bodyRef.current) {
      bodyRef.current.style.transform = "rotateX(0deg) rotateY(0deg)";
    }
  }, []);

  return (
    <CardContext.Provider value={{ registerBody }}>
      <div
        className={cn("group/card h-full [perspective:1000px]", className)}
        onMouseMove={handleMouseMove}
        onMouseLeave={resetTransform}
      >
        {children}
      </div>
    </CardContext.Provider>
  );
}

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className }: CardBodyProps) {
  const context = React.useContext(CardContext);
  const localRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    context?.registerBody(localRef.current);

    return () => {
      context?.registerBody(null);
    };
  }, [context]);

  return (
    <div
      ref={localRef}
      className={cn(
        "h-full rounded-2xl transition-transform duration-300 ease-out [transform-style:preserve-3d]",
        className,
      )}
    >
      {children}
    </div>
  );
}

type CardItemProps<T extends React.ElementType> = {
  as?: T;
  children: React.ReactNode;
  className?: string;
  translateZ?: number | string;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function CardItem<T extends React.ElementType = "div">({
  as,
  children,
  className,
  translateZ = 0,
  ...rest
}: CardItemProps<T>) {
  const Element = (as || "div") as React.ElementType;
  const itemRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const item = itemRef.current;
    if (!item) {
      return;
    }

    const value = typeof translateZ === "number" ? `${translateZ}px` : translateZ;
    item.style.transform = value ? `translateZ(${value})` : "translateZ(0px)";
  }, [translateZ]);

  return React.createElement(
    Element,
    {
      ref: itemRef,
      className: cn("[transform-style:preserve-3d] transition-transform duration-300", className),
      ...rest,
    },
    children,
  );
}

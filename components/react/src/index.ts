import React from "react";

export interface ReactComponentPreset {
  name: string;
  framework: "react";
}

export const reactComponentPreset: ReactComponentPreset = {
  name: "quick-start-react-components",
  framework: "react"
};

export interface PageContainerProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageContainer({ title, description, actions, children }: PageContainerProps) {
  return React.createElement("section", { className: "tsu-page-container" }, [
    React.createElement("header", { className: "tsu-page-container__header", key: "header" }, [
      React.createElement("h2", { className: "tsu-page-container__title", key: "title" }, title),
      description ? React.createElement("p", { className: "tsu-page-container__description", key: "description" }, description) : null,
      actions ? React.createElement("div", { className: "tsu-page-container__actions", key: "actions" }, actions) : null
    ]),
    React.createElement("div", { className: "tsu-page-container__body", key: "body" }, children)
  ]);
}

export interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({ title = "No data", description = "There is nothing to show yet." }: EmptyStateProps) {
  return React.createElement("div", { className: "tsu-state tsu-state--empty" }, [
    React.createElement("strong", { className: "tsu-state__title", key: "title" }, title),
    React.createElement("p", { className: "tsu-state__description", key: "description" }, description)
  ]);
}

export interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Loading..." }: LoadingStateProps) {
  return React.createElement("div", { className: "tsu-state tsu-state--loading", role: "status" }, label);
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  actions?: string[];
  onAction?: (action: string) => void;
}

export function ErrorState({ title = "Something went wrong", message, actions = [], onAction }: ErrorStateProps) {
  return React.createElement("div", { className: "tsu-state tsu-state--error", role: "alert" }, [
    React.createElement("strong", { className: "tsu-state__title", key: "title" }, title),
    React.createElement("p", { className: "tsu-state__description", key: "description" }, message),
    actions.length
      ? React.createElement(
          "div",
          { className: "tsu-state__actions", key: "actions" },
          actions.map((action) =>
            React.createElement(
              "button",
              {
                className: "tsu-state__button",
                key: action,
                type: "button",
                onClick: () => onAction?.(action)
              },
              action
            )
          )
        )
      : null
  ]);
}

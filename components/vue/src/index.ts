import { defineComponent, h, type PropType } from "vue";

export interface VueComponentPreset {
  name: string;
  framework: "vue";
}

export const vueComponentPreset: VueComponentPreset = {
  name: "quick-start-vue-components",
  framework: "vue"
};

export const PageContainer = defineComponent({
  name: "TsuPageContainer",
  props: {
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ""
    }
  },
  setup(props, { slots }) {
    return () =>
      h("section", { class: "tsu-page-container" }, [
        h("header", { class: "tsu-page-container__header" }, [
          h("h2", { class: "tsu-page-container__title" }, props.title),
          props.description ? h("p", { class: "tsu-page-container__description" }, props.description) : null,
          slots.actions ? h("div", { class: "tsu-page-container__actions" }, slots.actions()) : null
        ]),
        h("div", { class: "tsu-page-container__body" }, slots.default?.())
      ]);
  }
});

export const EmptyState = defineComponent({
  name: "TsuEmptyState",
  props: {
    title: {
      type: String,
      default: "No data"
    },
    description: {
      type: String,
      default: "There is nothing to show yet."
    }
  },
  setup(props) {
    return () =>
      h("div", { class: "tsu-state tsu-state--empty" }, [
        h("strong", { class: "tsu-state__title" }, props.title),
        h("p", { class: "tsu-state__description" }, props.description)
      ]);
  }
});

export const LoadingState = defineComponent({
  name: "TsuLoadingState",
  props: {
    label: {
      type: String,
      default: "Loading..."
    }
  },
  setup(props) {
    return () => h("div", { class: "tsu-state tsu-state--loading", role: "status" }, props.label);
  }
});

export const ErrorState = defineComponent({
  name: "TsuErrorState",
  props: {
    title: {
      type: String,
      default: "Something went wrong"
    },
    message: {
      type: String,
      required: true
    },
    actions: {
      type: Array as PropType<string[]>,
      default: () => []
    }
  },
  emits: ["action"],
  setup(props, { emit }) {
    return () =>
      h("div", { class: "tsu-state tsu-state--error", role: "alert" }, [
        h("strong", { class: "tsu-state__title" }, props.title),
        h("p", { class: "tsu-state__description" }, props.message),
        props.actions.length
          ? h(
              "div",
              { class: "tsu-state__actions" },
              props.actions.map((action) =>
                h(
                  "button",
                  {
                    class: "tsu-state__button",
                    type: "button",
                    onClick: () => emit("action", action)
                  },
                  action
                )
              )
            )
          : null
      ]);
  }
});

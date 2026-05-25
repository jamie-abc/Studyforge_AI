<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { CalendarClock, CircleHelp, MessageSquarePlus, RefreshCw, Send } from '@lucide/vue';
import { createHelpAnswer, createHelpRequest, getHelpAnswers, getHelpRequests } from '@/api/help';
import EmptyState from '@/components/EmptyState.vue';
import LoadingState from '@/components/LoadingState.vue';
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';
import { usePreferencesStore } from '@/stores/preferences';
import { useSessionStore } from '@/stores/session';
import type { HelpAnswer, HelpRequest } from '@/types/api';
import { formatShortDateTime } from '@/utils/date';

const sessionStore = useSessionStore();
const preferencesStore = usePreferencesStore();
const route = useRoute();
const helps = ref<HelpRequest[]>([]);
const answers = ref<Record<number, HelpAnswer[]>>({});
const activeHelpId = ref<number | null>(null);
const loading = ref(false);
const errorMessage = ref('');
const answerText = ref('');

const form = reactive({
  title: '',
  description: '',
  categoryId: 1,
  rewardPoints: 0
});

const titleInput = ref<HTMLInputElement | null>(null);
const activeHelp = computed(() => helps.value.find((item) => item.helpId === activeHelpId.value) ?? helps.value[0] ?? null);
const activeAnswers = computed(() => (activeHelp.value ? answers.value[activeHelp.value.helpId] ?? [] : []));
const openHelpCount = computed(() => helps.value.filter((item) => normalizeStatus(item.status) === 'OPEN').length);
const solvedHelpCount = computed(() => helps.value.filter((item) => ['SOLVED', 'RESOLVED', 'CLOSED'].includes(normalizeStatus(item.status))).length);
const totalRewardPoints = computed(() => helps.value.reduce((total, item) => total + Number(item.rewardPoints || 0), 0));

function routeHelpId() {
  const value = Number(route.query.helpId);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeStatus(status: string) {
  return (status || '').toUpperCase();
}

function statusLabel(status: string) {
  const normalized = normalizeStatus(status);
  if (normalized === 'OPEN') {
    return '进行中';
  }
  if (normalized === 'SOLVED' || normalized === 'RESOLVED') {
    return '已解决';
  }
  if (normalized === 'CLOSED') {
    return '已关闭';
  }
  return status || '待处理';
}

function focusCompose() {
  titleInput.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  titleInput.value?.focus();
}

async function loadHelps() {
  loading.value = true;
  errorMessage.value = '';

  try {
    helps.value = await getHelpRequests();
    const targetHelpId = routeHelpId();
    activeHelpId.value = targetHelpId && helps.value.some((item) => item.helpId === targetHelpId) ? targetHelpId : (activeHelpId.value ?? helps.value[0]?.helpId ?? null);
    if (activeHelpId.value) {
      await loadAnswers(activeHelpId.value);
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '求助内容暂时没取到';
  } finally {
    loading.value = false;
  }
}

async function loadAnswers(helpId: number) {
  answers.value = {
    ...answers.value,
    [helpId]: await getHelpAnswers(helpId)
  };
}

async function publishHelp() {
  if (!sessionStore.isAuthenticated) {
    errorMessage.value = '请先登录再发布求助';
    return;
  }

  try {
    const helpId = await createHelpRequest({ ...form });
    form.title = '';
    form.description = '';
    form.rewardPoints = 0;
    await loadHelps();
    activeHelpId.value = helpId;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '暂时发布不了求助';
  }
}

async function sendAnswer() {
  if (!activeHelp.value || !answerText.value.trim()) {
    return;
  }
  if (!sessionStore.isAuthenticated) {
    errorMessage.value = '请先登录再回答';
    return;
  }

  try {
    await createHelpAnswer(activeHelp.value.helpId, answerText.value);
    answerText.value = '';
    await loadAnswers(activeHelp.value.helpId);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '暂时发送不了回答';
  }
}

async function selectHelp(helpId: number) {
  activeHelpId.value = helpId;
  if (!answers.value[helpId]) {
    await loadAnswers(helpId);
  }
}

function helpTime(help: HelpRequest) {
  return formatShortDateTime(help.createdTime, preferencesStore.languageCode);
}

function answerTime(answer: HelpAnswer) {
  return formatShortDateTime(answer.createdTime, preferencesStore.languageCode);
}

onMounted(loadHelps);

watch(
  () => route.query.helpId,
  async () => {
    const targetHelpId = routeHelpId();
    if (!targetHelpId || !helps.value.some((item) => item.helpId === targetHelpId)) {
      return;
    }
    await selectHelp(targetHelpId);
  }
);
</script>

<template>
  <section class="help-page">
    <div class="help-hero">
      <div class="help-hero-copy">
        <span class="section-kicker">Help Desk</span>
        <h1>求助讨论</h1>
        <p>把问题背景、尝试过的办法和期望结果写清楚，社区成员可以直接给出步骤、资料或排查方向。</p>
        <div class="help-hero-actions">
          <button class="primary-button" type="button" @click="focusCompose">
            <MessageSquarePlus :size="18" />
            <span>提出问题</span>
          </button>
          <button class="secondary-button" type="button" :disabled="loading" @click="loadHelps">
            <RefreshCw :size="17" />
            <span>刷新列表</span>
          </button>
        </div>
      </div>
      <div class="help-hero-stats" aria-label="求助讨论统计">
        <div>
          <strong>{{ helps.length }}</strong>
          <span>全部问题</span>
        </div>
        <div>
          <strong>{{ openHelpCount }}</strong>
          <span>等待讨论</span>
        </div>
        <div>
          <strong>{{ solvedHelpCount }}</strong>
          <span>已有结论</span>
        </div>
        <div>
          <strong>{{ totalRewardPoints }}</strong>
          <span>积分奖励</span>
        </div>
      </div>
    </div>

    <div class="help-layout">
      <main class="help-main">
        <section class="help-list">
          <div class="feed-toolbar help-section-toolbar">
            <div>
              <strong>最近的问题</strong>
              <small>选择一个问题查看背景、回答和补充建议</small>
            </div>
          </div>

          <LoadingState v-if="loading" label="正在加载求助" />
          <EmptyState v-else-if="errorMessage" title="暂时无法加载" :description="errorMessage" />
          <EmptyState v-else-if="helps.length === 0" title="还没有求助" description="遇到卡点时，可以从这里发起一个问题。" />

          <div v-else class="help-items">
            <button
              v-for="help in helps"
              :key="help.helpId"
              class="help-item"
              :class="{ active: help.helpId === activeHelp?.helpId }"
              type="button"
              @click="selectHelp(help.helpId)"
            >
              <span class="help-item-topline">
                <span class="help-status-pill" :data-status="normalizeStatus(help.status)">{{ statusLabel(help.status) }}</span>
                <span v-if="help.rewardPoints > 0" class="help-reward-pill">{{ help.rewardPoints }} 分</span>
              </span>
              <strong>{{ help.title }}</strong>
              <small>{{ help.description }}</small>
              <span class="help-item-footer">
                <span>提问者 #{{ help.userId }}</span>
                <span v-if="helpTime(help)" class="time-line">
                  <CalendarClock :size="14" />
                  {{ helpTime(help) }}
                </span>
              </span>
            </button>
          </div>
        </section>

        <div class="help-detail-stack">
          <section v-if="activeHelp" class="help-detail">
            <div class="help-detail-topline">
              <span class="help-status-pill" :data-status="normalizeStatus(activeHelp.status)">{{ statusLabel(activeHelp.status) }}</span>
              <span>提问者 #{{ activeHelp.userId }}</span>
              <span v-if="activeHelp.rewardPoints > 0">{{ activeHelp.rewardPoints }} 积分</span>
              <span>{{ activeAnswers.length }} 条回答</span>
              <span v-if="helpTime(activeHelp)">
                <CalendarClock :size="15" />
                {{ helpTime(activeHelp) }}
              </span>
            </div>
            <h2>{{ activeHelp.title }}</h2>
            <MarkdownRenderer class="help-markdown" :content="activeHelp.description" />
          </section>

          <section v-if="activeHelp" class="help-answer-panel">
            <div class="panel-title">
              <CircleHelp :size="18" />
              <span>回答与建议</span>
            </div>
            <div v-if="activeAnswers.length" class="comment-list help-answer-list">
              <article v-for="answer in activeAnswers" :key="answer.answerId" class="comment-item help-answer-item">
                <div class="comment-meta">
                  <strong>#{{ answer.userId }}</strong>
                  <time v-if="answerTime(answer)">{{ answerTime(answer) }}</time>
                </div>
                <MarkdownRenderer class="comment-markdown" :content="answer.content" />
              </article>
            </div>
            <p v-else>还没有回答。可以先给出一个排查方向、参考资料或可执行步骤。</p>
            <form class="compact-form help-answer-form" @submit.prevent="sendAnswer">
              <textarea v-model.trim="answerText" rows="5" placeholder="写下你的建议、步骤或参考资料，支持 Markdown" />
              <button class="secondary-button full-width" type="submit">提交回答</button>
            </form>
          </section>
        </div>
      </main>

      <aside class="help-aside">
        <section class="side-panel help-compose-panel">
          <div class="panel-title">
            <MessageSquarePlus :size="18" />
            <span>提出问题</span>
          </div>
          <form class="compact-form" @submit.prevent="publishHelp">
            <label>
              <span>标题</span>
              <input id="help-title" ref="titleInput" v-model.trim="form.title" required placeholder="一句话说清卡在哪里" />
            </label>
            <label>
              <span>背景</span>
              <textarea v-model.trim="form.description" required rows="8" placeholder="写下你已经试过什么、希望得到什么帮助，支持 Markdown" />
            </label>
            <label>
              <span>奖励积分</span>
              <input v-model.number="form.rewardPoints" min="0" type="number" />
            </label>
            <button class="primary-button full-width" type="submit">
              <Send :size="17" />
              <span>发布求助</span>
            </button>
          </form>
        </section>

        <section class="side-panel help-guide-panel">
          <div class="panel-title">
            <CircleHelp :size="18" />
            <span>更容易得到帮助</span>
          </div>
          <ul>
            <li>写清楚环境、报错信息和已经尝试过的方法。</li>
            <li>把期望结果拆成具体问题，别人更容易定位。</li>
            <li>回答可以使用 Markdown，代码、链接和步骤会更清晰。</li>
          </ul>
        </section>
      </aside>
    </div>
  </section>
</template>

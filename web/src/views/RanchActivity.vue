<script setup lang="ts">
// 牧场的「活动」与农场的活动中心是同一套：活动数据按账号维度拉取，与所在场景无关。
// 直接复用农场活动页，不做区分（此前这里是只有占位文案的空壳）。
import Activity from './Activity.vue'
</script>

<template>
  <Activity />
</template>

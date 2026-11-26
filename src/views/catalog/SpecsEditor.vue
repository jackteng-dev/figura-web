<script setup lang="ts">
// 商品規格編輯（Commerce V2）：所有欄位選填，留空＝未提供，請勿填入未確認的規格。
// AI 虛構展示商品的「設定材質」只是概念描述，不會出現在公開的材質規格或結構化資料。
import { computed, ref, watch } from 'vue'
import { SCALES, scaleLabel, MATERIAL_LABELS, TYPE_LABELS, EDITION_LABELS, type ProductSpecs } from '@/api/catalog'
const specs = defineModel<ProductSpecs>({ required: true })
const accessoriesText = computed({
  get: () => specs.value.accessories.join('\n'),
  set: v => { specs.value.accessories = v.split('\n') }
})
// 輸入模式獨立保存：切換時才清掉另一欄（日期與月份只能擇一）
const releaseKind = ref<'date' | 'month'>(specs.value.releaseDate ? 'date' : 'month')
watch(() => specs.value, s => { releaseKind.value = s.releaseDate ? 'date' : 'month' })
watch(releaseKind, v => { if (v === 'date') specs.value.releaseMonth = null; else specs.value.releaseDate = null })
function toggle(list: string[], code: string) { const i = list.indexOf(code); i >= 0 ? list.splice(i, 1) : list.push(code) }
</script>

<template>
  <fieldset class="specs-editor">
    <legend>商品規格（選填）</legend>
    <p class="hint">只填寫已確認的資料；留空表示「未提供」，前台不會顯示該列。</p>
    <label class="check"><input type="checkbox" :checked="specs.contentOrigin === 'AI_CONCEPT'" @change="specs.contentOrigin = ($event.target as HTMLInputElement).checked ? 'AI_CONCEPT' : 'REAL'"> AI 虛構展示商品（非實際販售／製造規格）</label>
    <div class="grid">
      <div><label for="spec-character">角色名稱</label><input id="spec-character" v-model="specs.characterName" class="form-control" maxlength="120"></div>
      <div><label for="spec-maker">製造商</label><input id="spec-maker" v-model="specs.manufacturer" class="form-control" maxlength="80" placeholder="與品牌不同時填寫"></div>
      <div><label for="spec-scale">比例</label><select id="spec-scale" v-model="specs.scale" class="form-control"><option :value="null">未提供</option><option v-for="s in SCALES" :key="s" :value="s">{{ scaleLabel(s) }}</option></select></div>
      <div><label for="spec-height">全高（mm，含底座）</label><input id="spec-height" v-model.number="specs.heightMm" type="number" min="1" max="5000" step="1" class="form-control"></div>
      <div class="wide"><label for="spec-dimensions">其他尺寸說明</label><input id="spec-dimensions" v-model="specs.dimensions" class="form-control" maxlength="160" placeholder="例：寬 120 × 深 110 mm"></div>
      <div><label for="spec-type">商品類型</label><select id="spec-type" v-model="specs.productType" class="form-control"><option :value="null">未提供</option><option v-for="(l, k) in TYPE_LABELS" :key="k" :value="k">{{ l }}</option></select></div>
      <div><label for="spec-edition">商品版本</label><select id="spec-edition" v-model="specs.edition" class="form-control"><option :value="null">未提供</option><option v-for="(l, k) in EDITION_LABELS" :key="k" :value="k">{{ l }}</option></select></div>
    </div>
    <label class="check"><input v-model="specs.limited" type="checkbox"> 限定商品</label>
    <div v-if="specs.contentOrigin === 'REAL'">
      <span class="label">材質</span>
      <div class="chips"><label v-for="(l, k) in MATERIAL_LABELS" :key="k" class="check"><input type="checkbox" :checked="specs.materials.includes(k)" @change="toggle(specs.materials, k)"> {{ l }}</label></div>
    </div>
    <div v-else>
      <span class="label">設定材質（AI 概念，不當作製造規格）</span>
      <div class="chips"><label v-for="(l, k) in MATERIAL_LABELS" :key="k" class="check"><input type="checkbox" :checked="specs.conceptMaterials.includes(k)" @change="toggle(specs.conceptMaterials, k)"> {{ l }}</label></div>
    </div>
    <div class="grid">
      <div><label for="spec-release-kind">預計發售</label><select id="spec-release-kind" v-model="releaseKind" class="form-control"><option value="month">只知道月份</option><option value="date">確定日期</option></select></div>
      <div v-if="releaseKind === 'date'"><label for="spec-release-date">發售日</label><input id="spec-release-date" v-model="specs.releaseDate" type="date" class="form-control"></div>
      <div v-else><label for="spec-release-month">發售月份</label><input id="spec-release-month" v-model="specs.releaseMonth" type="month" class="form-control"></div>
    </div>
    <label for="spec-accessories">配件與附屬品（一行一項）</label><textarea id="spec-accessories" v-model="accessoriesText" class="form-control" rows="4" maxlength="1000" />
    <label for="spec-note">規格補充說明</label><textarea id="spec-note" v-model="specs.specNote" class="form-control" rows="3" maxlength="2000" />
    <p class="hint">預購開始與截止時間請在「預購批次」設定，前台會自動顯示。</p>
  </fieldset>
</template>

<style scoped>
.specs-editor { border: 1px solid #e3e5ec; border-radius: 8px; padding: 12px 16px 16px; margin: 20px 0; }
.specs-editor legend { font-size: 18px; font-weight: 700; float: none; width: auto; padding: 0 6px; }
.hint { font-size: 13px; color: #4b5060; margin: 4px 0 8px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.grid .wide { grid-column: 1 / -1; }
.check { display: flex !important; gap: 8px; align-items: center; margin: 10px 0 !important; }
.label { display: block; margin: 16px 0 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.chips .check { margin: 4px 0 !important; }
@media (max-width: 500px) { .grid { grid-template-columns: 1fr; } }
</style>

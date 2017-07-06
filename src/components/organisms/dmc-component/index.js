import forEach from 'mout/array/forEach';
import swagger from '../../../core/swagger';
import { constants as actions } from '../../../store/actions';
import { constants as getters } from '../../../store/getters';
import { constants as states } from '../../../store/states';
import '../../atoms/dmc-message/index.tag';
import './searchbox.tag';

export default function() {
  const store = this.riotx.get();

  // データ取得中か否か。
  this.isPending = true;
  // レスポンスデータが有効か否か。
  this.isValidData = false;
  // レスポンスデータが不正の時に表示するエラー文言。
  this.alertApi = '';
  this.alertText = '';
  // レスポンスデータ。
  this.data = null;
  // ページング情報。
  this.pagination = null;
  // ページング情報。
  this.search = null;
  // 自身に関するアクション群。
  this.selfActions = null;
  // テーブル行に関するアクション群。
  this.rowActions = null;
  // テーブルのrow表示ラベル。
  this.tableLabels = null;
  // コンポーネントにrenderするRiotタグ名。
  this.childComponentName = null;
  if (swagger.isComponentStyleNumber(this.opts.component.style)) {
    this.childComponentName = 'dmc-component-number';
  } else if (swagger.isComponentStyleTable(this.opts.component.style)) {
    this.childComponentName = 'dmc-component-table';
  } else if (swagger.isComponentStyleGraphBar(this.opts.component.style)) {
    this.childComponentName = 'dmc-component-graph-bar';
  } else if (swagger.isComponentStyleGraphScatterplot(this.opts.component.style)) {
    this.childComponentName = 'dmc-component-graph-scatterplot';
  } else if (swagger.isComponentStyleGraphLine(this.opts.component.style)) {
    this.childComponentName = 'dmc-component-graph-line';
  } else if (swagger.isComponentStyleGraphHorizontalBar(this.opts.component.style)) {
    this.childComponentName = 'dmc-component-graph-horizontal-bar';
  } else if (swagger.isComponentStyleGraphStackedBar(this.opts.component.style)) {
    this.childComponentName = 'dmc-component-graph-stacked-bar';
  } else if (swagger.isComponentStyleGraphHorizontalStackedBar(this.opts.component.style)) {
    this.childComponentName = 'dmc-component-graph-horizontal-stacked-bar';
  } else if (swagger.isComponentStyleGraphStackedArea(this.opts.component.style)) {
    this.childComponentName = 'dmc-component-graph-stacked-area';
  }

  // コンポーネントを更新するための関数。
  // 子コンポーネントに渡されます。
  this.updater = (query = {}) => {
    this.isPending = true;
    this.update();
    return Promise
      .resolve()
      .then(() => new Promise(resolve => {
        // 通信が速すぎると見た目がチカチカするので、意図的に通信を遅らせる。
        setTimeout(() => {
          resolve();
        }, 1000);
      }))
      .then(() => store.action(actions.COMPONENTS_GET_ONE, this._riot_id, this.opts.component, query))
      .catch(err => store.action(actions.MODALS_ADD, {
        error: err
      }));
  };

  this.validateResponse = data => {
    const type = data.getType();
    const method = this.opts.component.api.method;
    const path = this.opts.component.api.path;
    const style = this.opts.component.style;

    if (swagger.isComponentStyleNumber(this.opts.component.style)) {
      if (type !== 'object' || data.getValue('value') === undefined) {
        this.isValidData = false;
        this.alertApi = `${method}: ${path}`;
        this.alertText = `response of component styled "${style}" should be form of "object" and have "value" key.`;
        return;
      }
    }

    if (swagger.isComponentStyleTable(this.opts.component.style)) {
      if (type !== 'array') {
        this.isValidData = false;
        this.alertApi = `${method}: ${path}`;
        this.alertText = `response of component styled "${style}" should be form of "array".`;
        return;
      }
      if (!data.getLength() || data.getValue(0).getType() !== 'object') {
        this.isValidData = false;
        this.alertApi = `${method}: ${path}`;
        this.alertText = `response of component styled "${style}" should be composed with "object".`;
        return;
      }
    }

    if (swagger.isComponentStyleGraph(this.opts.component.style)) {
      if (type !== 'object') {
        this.isValidData = false;
        this.alertApi = `${method}: ${path}`;
        this.alertText = `response of component styled "${style}" should be form of "object".`;
        return;
      }
      if (!data.getValue('data') || !data.getValue('x') || !data.getValue('y') || data.getValue('data').getType() !== 'array') {
        this.isValidData = false;
        this.alertApi = `${method}: ${path}`;
        this.alertText = `response of component styled "${style}" should be composed with at least "x", "y" and "data". "data" value type sholud be an "array".`;
        return;
      }
      if (!data.getValue('data').getLength()) {
        this.isValidData = false;
        this.alertApi = `${method}: ${path}`;
        this.alertText = 'empty';
        return;
      }
    }

    this.isValidData = true;
    this.alertText = '';
  };

  this.on('mount', () => {
    this.updater();
  }).on('updated', () => {
    this.rebindTouchEvents();
  });

  this.listen(states.COMPONENTS_ONE(this._riot_id), () => {
    this.isPending = false;
    const component = store.getter(getters.COMPONENTS_ONE, this._riot_id);
    this.data = component.data;
    if (component.pagination && component.pagination.maxPage > 1) {
      this.pagination = component.pagination;
    } else {
      this.pagination = null;
    }
    this.search = component.search;
    this.selfActions = store.getter(getters.COMPONENTS_ONE_SELF_ACTIONS, this._riot_id);
    this.rowActions = store.getter(getters.COMPONENTS_ONE_ROW_ACTIONS, this._riot_id);
    this.tableLabels = store.getter(getters.COMPONENTS_ONE_TABLE_LABELS, this._riot_id);
    this.validateResponse(this.data);
    this.update();
  });

  this.handleRefreshButtonTap = () => {
    Promise
      .resolve()
      .then(() => {
        // 更新時に高さが変わらないように。
        const rect = this.refs.body.getBoundingClientRect();
        this.refs.body.style.height = `${rect.height}px`;
      })
      .then(() => this.updater())
      .then(() => {
        this.refs.body.style.height = '';
      });
  };

  this.handleSearchButtonTap = () => {
    if (this.isPending) {
      return;
    }

    const queries = [];
    forEach(this.search, query => {
      queries.push({
        key: query.key,
        type: query.type
      });
    });
    Promise
      .resolve()
      .then(() => store.action(actions.MODALS_ADD, 'dmc-component-searchbox', {
        queries,
        onSearch: queries => {
          this.updater(queries);
        }
      }))
      .catch(err => store.action(actions.MODALS_ADD, 'dmc-message', {
        error: err
      }));
  };

  this.handlePaginationChange = page => {
    this.updater({
      limit: this.pagination.size,
      offset: (page - 1) * this.pagination.size
    });
  };
}
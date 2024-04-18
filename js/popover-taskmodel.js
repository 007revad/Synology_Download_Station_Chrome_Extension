var TaskModel = (function () {
    function TaskModel(data) {
        var _this = this;
        this.removed = ko.observable(false);
        this.pausing = ko.observable(false);
        this.resuming = ko.observable(false);
        this.pauseButtonVisible = ko.computed(function () {
            return ['paused', 'finished', 'error'].indexOf(_this.status()) == -1;
        });
        this.resumeButtonVisible = ko.computed(function () {
            return ['error', 'paused'].indexOf(_this.status()) !== -1;
        });
        this.visible = ko.computed(function () {
            return _this.removed() == false &&
                !(viewModel.hideSeedingTorrents() && _this.status() == 'seeding');
        });
        this.progress = ko.computed(function () {
            if (_this.status() == "extracting" && _this.unzipProgress() != null)
                return _this.unzipProgressString();
            else if (_this.status() == "seeding" && _this.uploadRatio() != null)
                return _this.uploadRatioString();
            else
                return _this.downloadProgressString();
        });
        this.progressBarStripedClass = ko.computed(function () {
            var cssClass = "";
            switch (_this.status()) {
                case "waiting":
                case "finishing":
                case "hash_checking":
                case "seeding":
                case "filehost_waiting":
                    cssClass += " progress-striped active";
                    break;
            }
            if ((_this.status() == "extracting" && _this.unzipProgress() != null) || (_this.status() == "seeding" && _this.uploadRatio() != null))
                cssClass += " fill-bar";
            return cssClass;
        });
        this.progressBarClass = ko.computed(function () {
            var cssClass;
            switch (_this.status()) {
                case "error":
                    cssClass = "progress-bar-danger";
                    break;
                case "finished":
                case "seeding":
                    cssClass = "progress-bar-success";
                    break;
                default:
                    cssClass = "progres-bar-info";
            }
            return cssClass;
        });
        this.progressText = ko.computed(function () {
            var sizeDownloaded = _this.sizeDownloaded();
            var totalSize = _this.size();
            var sizeString;
            if (sizeDownloaded == totalSize) {
                sizeString = _this.sizeString();
            }
            else {
                sizeString = extension.getLocalizedString("progressOf", [_this.sizeDownloadedString(), _this.sizeString()]);
            }
            return sizeString + " - " + _this.statusText();
        });
        this.statusText = ko.computed(function () {
            var localizedStatus = extension.getLocalizedString("task_status_" + _this.status());
            var errorDetail = typeof _this.errorDetail() === "string" ? _this.errorDetail() : _this.status();
            switch (_this.status()) {
                case "downloading":
                    return _this.etaString() ?
                        (localizedStatus + " (" + _this.speedDownloadString() + ", " + _this.etaString() + ")") :
                        (localizedStatus + " (" + _this.speedDownloadString() + ")");
                case "seeding":
                    return localizedStatus + " (" + _this.speedUploadString() + ")";
                case "extracting":
                    return localizedStatus + " (" + _this.unzipProgress() + "%)";
                case "error":
                    return typeof _this.errorDetail() === "string" ?
                        extension.getLocalizedString("task_status_" + _this.errorDetail()) :
                        localizedStatus;
                default:
                    return localizedStatus;
            }
        });
        ko.mapping.fromJS(data, {}, this);
    }
    TaskModel.prototype.resume = function () {
        var _this = this;
        if (!this.resuming()) {
            this.resuming(true);
            getBackgroundPage().resumeTask(this.id(), function (success) {
                _this.resuming(false);
                if (success) {
                    _this.status("waiting");
                }
            });
        }
    };
    ;
    TaskModel.prototype.pause = function () {
        var _this = this;
        if (!this.pausing()) {
            this.pausing(true);
            getBackgroundPage().pauseTask(this.id(), function (success) {
                _this.pausing(false);
                if (success) {
                    _this.status("paused");
                }
            });
        }
    };
    ;
    TaskModel.prototype.toggleConfirmRemove = function (item, event) {
        $(event.target).closest("li").find(".confirm-delete").toggleClass("active");
        $(event.target).closest("li").find(".task-status").toggleClass("faded");
    };
    ;
    TaskModel.prototype.remove = function () {
        var _this = this;
        if (!this.removed()) {
            this.removed(true);
            getBackgroundPage().deleteTask(this.id(), function (success, data) {
                _this.removed(success);
            });
        }
    };
    ;
    return TaskModel;
}());

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImpzL3BvcG92ZXItdGFza21vZGVsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0lBdUJJLG1CQUFZLElBQTBCO1FBdkIxQyxpQkE4SkM7UUEzSUEsWUFBTyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDL0IsWUFBTyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDL0IsYUFBUSxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7UUFNaEMsdUJBQWtCLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBVTtZQUN6QyxNQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUUsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNyRSxDQUFDLENBQUMsQ0FBQztRQUVILHdCQUFtQixHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQVU7WUFDMUMsTUFBTSxDQUFDLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUMxRCxDQUFDLENBQUMsQ0FBQztRQUVILFlBQU8sR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFVO1lBQzlCLE1BQU0sQ0FBQyxLQUFJLENBQUMsT0FBTyxFQUFFLElBQUksS0FBSztnQkFDNUIsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLEtBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxTQUFTLENBQUMsQ0FBQztRQUNwRSxDQUFDLENBQUMsQ0FBQztRQUVILGFBQVEsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFTO1lBQzlCLEVBQUUsQ0FBQSxDQUFDLEtBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxZQUFZLElBQUksS0FBSSxDQUFDLGFBQWEsRUFBRSxJQUFJLElBQUks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QUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN6RSxDQUFDOztJQUVELDBCQUFNLEdBQU47UUFBQSxpQkFPQztRQU5BLEVBQUUsQ0FBQSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNwQixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ25CLGlCQUFpQixFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxVQUFDLE9BQWdCLEVBQUUsSUFBUztnQkFDckUsS0FBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUN2QixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUM7SUFDRixDQUFDOztJQUNGLGdCQUFDO0FBQUQsQ0E5SkEsQUE4SkMsSUFBQSIsImZpbGUiOiJqcy9wb3BvdmVyLXRhc2ttb2RlbC5qcyIsInNvdXJjZXNDb250ZW50IjpbImNsYXNzIFRhc2tNb2RlbCB7XG4gICAgaWQ6IEtub2Nrb3V0T2JzZXJ2YWJsZTxzdHJpbmc+O1xuICAgIHN0YXR1czogS25vY2tvdXRPYnNlcnZhYmxlPHN0cmluZz47XG4gICAgZXJyb3JEZXRhaWw6IEtub2Nrb3V0T2JzZXJ2YWJsZTxzdHJpbmc+O1xuICAgIHVuemlwUHJvZ3Jlc3M6IEtub2Nrb3V0T2JzZXJ2YWJsZTxzdHJpbmc+O1xuICAgIHVuemlwUHJvZ3Jlc3NTdHJpbmc6IEtub2Nrb3V0T2JzZXJ2YWJsZTxzdHJpbmc+O1xuICAgIHVwbG9hZFJhdGlvOiBLbm9ja291dE9ic2VydmFibGU8bnVtYmVyPjtcbiAgICB1cGxvYWRSYXRpb1N0cmluZzogS25vY2tvdXRPYnNlcnZhYmxlPHN0cmluZz47XG4gICAgc2l6ZTogS25vY2tvdXRPYnNlcnZhYmxlPG51bWJlcj47XG4gICAgc2l6ZVN0cmluZzogS25vY2tvdXRPYnNlcnZhYmxlPHN0cmluZz47XG4gICAgc2l6ZURvd25sb2FkZWQ6IEtub2Nrb3V0T2JzZXJ2YWJsZTxudW1iZXI+O1xuICAgIHNpemVEb3dubG9hZGVkU3RyaW5nOiBLbm9ja291dE9ic2VydmFibGU8c3RyaW5nPjtcbiAgICBkb3dubG9hZFByb2dyZXNzU3RyaW5nOiBLbm9ja291dE9ic2VydmFibGU8c3RyaW5nPjtcbiAgICBzcGVlZERvd25sb2FkOiBLbm9ja291dE9ic2VydmFibGU8bnVtYmVyPjtcbiAgICBzcGVlZERvd25sb2FkU3RyaW5nOiBLbm9ja291dE9ic2VydmFibGU8c3RyaW5nPjtcbiAgICBzcGVlZFVwbG9hZDogS25vY2tvdXRPYnNlcnZhYmxlPG51bWJlcj47XG4gICAgc3BlZWRVcGxvYWRTdHJpbmc6IEtub2Nrb3V0T2JzZXJ2YWJsZTxzdHJpbmc+O1xuICAgIGV0YVN0cmluZzogS25vY2tvdXRPYnNlcnZhYmxlPHN0cmluZz47XG5cblx0cmVtb3ZlZCA9IGtvLm9ic2VydmFibGUoZmFsc2UpO1xuXHRwYXVzaW5nID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG5cdHJlc3VtaW5nID0ga28ub2JzZXJ2YWJsZShmYWxzZSk7XG5cdFxuICAgIGNvbnN0cnVjdG9yKGRhdGE6IElEb3dubG9hZFN0YXRpb25UYXNrKSB7XG4gICAgICAgIGtvLm1hcHBpbmcuZnJvbUpTKGRhdGEsIHt9LCB0aGlzKTtcbiAgICB9XG4gICAgXG5cdHBhdXNlQnV0dG9uVmlzaWJsZSA9IGtvLmNvbXB1dGVkPGJvb2xlYW4+KCgpID0+IHtcblx0XHRyZXR1cm4gWydwYXVzZWQnLCAnZmluaXNoZWQnLCAnZXJyb3InXS5pbmRleE9mKHRoaXMuc3RhdHVzKCkpID09IC0xO1xuXHR9KTtcblx0XG5cdHJlc3VtZUJ1dHRvblZpc2libGUgPSBrby5jb21wdXRlZDxib29sZWFuPigoKSA9PiB7XG5cdFx0cmV0dXJuIFsnZXJyb3InLCAncGF1c2VkJ10uaW5kZXhPZih0aGlzLnN0YXR1cygpKSAhPT0gLTE7XG5cdH0pO1xuXHRcblx0dmlzaWJsZSA9IGtvLmNvbXB1dGVkPGJvb2xlYW4+KCgpID0+IHtcblx0XHRyZXR1cm4gdGhpcy5yZW1vdmVkKCkgPT0gZmFsc2UgJiYgXG5cdFx0XHRcdCEodmlld01vZGVsLmhpZGVTZWVkaW5nVG9ycmVudHMoKSAmJiB0aGlzLnN0YXR1cygpID09ICdzZWVkaW5nJyk7XG5cdH0pO1xuXHRcblx0cHJvZ3Jlc3MgPSBrby5jb21wdXRlZDxzdHJpbmc+KCgpID0+IHtcblx0XHRpZih0aGlzLnN0YXR1cygpID09IFwiZXh0cmFjdGluZ1wiICYmIHRoaXMudW56aXBQcm9ncmVzcygpICE9IG51bGwpXG5cdFx0XHRyZXR1cm4gdGhpcy51bnppcFByb2dyZXNzU3RyaW5nKCk7XG5cdFx0ZWxzZSBpZiAodGhpcy5zdGF0dXMoKSA9PSBcInNlZWRpbmdcIiAmJiB0aGlzLnVwbG9hZFJhdGlvKCkgIT0gbnVsbClcblx0XHRcdHJldHVybiB0aGlzLnVwbG9hZFJhdGlvU3RyaW5nKCk7XG5cdFx0ZWxzZVxuXHRcdFx0cmV0dXJuIHRoaXMuZG93bmxvYWRQcm9ncmVzc1N0cmluZygpO1xuXHR9KTtcblx0XG5cdHByb2dyZXNzQmFyU3RyaXBlZENsYXNzID0ga28uY29tcHV0ZWQ8c3RyaW5nPigoKSA9PiB7XG5cdFx0dmFyIGNzc0NsYXNzID0gXCJcIjtcblx0XHRcblx0XHRzd2l0Y2godGhpcy5zdGF0dXMoKSkge1xuXHRcdFx0Y2FzZSBcIndhaXRpbmdcIjpcblx0XHRcdGNhc2UgXCJmaW5pc2hpbmdcIjpcblx0XHRcdGNhc2UgXCJoYXNoX2NoZWNraW5nXCI6XG5cdFx0XHRjYXNlIFwic2VlZGluZ1wiOlxuXHRcdFx0Y2FzZSBcImZpbGVob3N0X3dhaXRpbmdcIjpcblx0XHRcdFx0Y3NzQ2xhc3MgKz0gXCIgcHJvZ3Jlc3Mtc3RyaXBlZCBhY3RpdmVcIjtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdFxuXHRcdGlmICgodGhpcy5zdGF0dXMoKSA9PSBcImV4dHJhY3RpbmdcIiAmJiB0aGlzLnVuemlwUHJvZ3Jlc3MoKSAhPSBudWxsKSB8fCAodGhpcy5zdGF0dXMoKSA9PSBcInNlZWRpbmdcIiAmJiB0aGlzLnVwbG9hZFJhdGlvKCkgIT0gbnVsbCkpXG5cdFx0XHRjc3NDbGFzcyArPSBcIiBmaWxsLWJhclwiO1xuXHRcdFx0XG5cdFx0cmV0dXJuIGNzc0NsYXNzO1xuXHR9KTtcblx0XG5cdHByb2dyZXNzQmFyQ2xhc3MgPSBrby5jb21wdXRlZDxzdHJpbmc+KCgpID0+IHtcblx0XHR2YXIgY3NzQ2xhc3M6IHN0cmluZztcblx0XHRzd2l0Y2godGhpcy5zdGF0dXMoKSkge1xuXHRcdFx0Y2FzZSBcImVycm9yXCI6XG5cdFx0XHRcdGNzc0NsYXNzID0gXCJwcm9ncmVzcy1iYXItZGFuZ2VyXCI7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBcImZpbmlzaGVkXCI6XG5cdFx0XHRjYXNlIFwic2VlZGluZ1wiOlxuXHRcdFx0XHRjc3NDbGFzcyA9IFwicHJvZ3Jlc3MtYmFyLXN1Y2Nlc3NcIjtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRjc3NDbGFzcyA9IFwicHJvZ3Jlcy1iYXItaW5mb1wiO1xuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gY3NzQ2xhc3M7XG5cdH0pO1xuXHRcblx0cHJvZ3Jlc3NUZXh0ID0ga28uY29tcHV0ZWQ8c3RyaW5nPigoKSA9PiB7XG5cdFx0dmFyIHNpemVEb3dubG9hZGVkID0gdGhpcy5zaXplRG93bmxvYWRlZCgpXG5cdFx0dmFyIHRvdGFsU2l6ZSA9IHRoaXMuc2l6ZSgpO1xuXHRcdHZhciBzaXplU3RyaW5nOiBzdHJpbmc7XG5cdFx0aWYoc2l6ZURvd25sb2FkZWQgPT0gdG90YWxTaXplKXtcblx0XHRcdHNpemVTdHJpbmcgPSB0aGlzLnNpemVTdHJpbmcoKVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHNpemVTdHJpbmcgPSBleHRlbnNpb24uZ2V0TG9jYWxpemVkU3RyaW5nKFwicHJvZ3Jlc3NPZlwiLCBbdGhpcy5zaXplRG93bmxvYWRlZFN0cmluZygpLCB0aGlzLnNpemVTdHJpbmcoKV0pO1xuXHRcdH1cblx0XHRcblx0XHRyZXR1cm4gc2l6ZVN0cmluZyAgKyBcIiAtIFwiICsgdGhpcy5zdGF0dXNUZXh0KCk7XG5cdH0pO1xuXHRcblx0c3RhdHVzVGV4dCA9IGtvLmNvbXB1dGVkPHN0cmluZz4oKCkgPT4ge1xuXHRcdHZhciBsb2NhbGl6ZWRTdGF0dXMgPSBleHRlbnNpb24uZ2V0TG9jYWxpemVkU3RyaW5nKFwidGFza19zdGF0dXNfXCIgKyB0aGlzLnN0YXR1cygpKTtcblx0XHR2YXIgZXJyb3JEZXRhaWwgPSB0eXBlb2YgdGhpcy5lcnJvckRldGFpbCgpID09PSBcInN0cmluZ1wiID8gdGhpcy5lcnJvckRldGFpbCgpIDogdGhpcy5zdGF0dXMoKTtcblx0XHRcblx0XHRzd2l0Y2godGhpcy5zdGF0dXMoKSkge1xuXHRcdFx0Y2FzZSBcImRvd25sb2FkaW5nXCI6XG5cdFx0XHQgICAgcmV0dXJuIHRoaXMuZXRhU3RyaW5nKCkgP1xuXHRcdFx0ICAgICAgICAgICAgKGxvY2FsaXplZFN0YXR1cyArIFwiIChcIiArIHRoaXMuc3BlZWREb3dubG9hZFN0cmluZygpICsgXCIsIFwiICsgdGhpcy5ldGFTdHJpbmcoKSArIFwiKVwiKSA6XG5cdFx0XHQgICAgICAgICAgICAobG9jYWxpemVkU3RhdHVzICsgXCIgKFwiICsgdGhpcy5zcGVlZERvd25sb2FkU3RyaW5nKCkgKyBcIilcIik7XG5cdFx0XHRjYXNlIFwic2VlZGluZ1wiOlxuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemVkU3RhdHVzICsgXCIgKFwiICsgdGhpcy5zcGVlZFVwbG9hZFN0cmluZygpICsgXCIpXCI7XG5cdFx0XHRjYXNlIFwiZXh0cmFjdGluZ1wiOlxuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemVkU3RhdHVzICsgXCIgKFwiICsgdGhpcy51bnppcFByb2dyZXNzKCkgKyBcIiUpXCI7XG5cdFx0XHRjYXNlIFwiZXJyb3JcIjpcblx0XHRcdFx0cmV0dXJuIHR5cGVvZiB0aGlzLmVycm9yRGV0YWlsKCkgPT09IFwic3RyaW5nXCIgP1xuXHRcdFx0XHRcdFx0XHRcdGV4dGVuc2lvbi5nZXRMb2NhbGl6ZWRTdHJpbmcoXCJ0YXNrX3N0YXR1c19cIiArIHRoaXMuZXJyb3JEZXRhaWwoKSkgOlxuXHRcdFx0XHRcdFx0XHRcdGxvY2FsaXplZFN0YXR1cztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZWRTdGF0dXM7XG5cdFx0fVxuXHR9KTtcblx0XG5cdHJlc3VtZSgpOiB2b2lkIHtcblx0XHRpZighdGhpcy5yZXN1bWluZygpKSB7XG5cdFx0XHR0aGlzLnJlc3VtaW5nKHRydWUpO1xuXHRcdFx0Z2V0QmFja2dyb3VuZFBhZ2UoKS5yZXN1bWVUYXNrKHRoaXMuaWQoKSwgKHN1Y2Nlc3M6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0dGhpcy5yZXN1bWluZyhmYWxzZSk7XG5cdFx0XHRcdGlmKHN1Y2Nlc3MpIHtcblx0XHRcdFx0XHR0aGlzLnN0YXR1cyhcIndhaXRpbmdcIik7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcblx0XG5cdHBhdXNlKCk6IHZvaWQge1xuXHRcdGlmKCF0aGlzLnBhdXNpbmcoKSkge1xuXHRcdFx0dGhpcy5wYXVzaW5nKHRydWUpO1xuXHRcdFx0Z2V0QmFja2dyb3VuZFBhZ2UoKS5wYXVzZVRhc2sodGhpcy5pZCgpLCAoc3VjY2VzczogYm9vbGVhbikgPT4ge1xuXHRcdFx0XHR0aGlzLnBhdXNpbmcoZmFsc2UpO1xuXHRcdFx0XHRpZihzdWNjZXNzKSB7XG5cdFx0XHRcdFx0dGhpcy5zdGF0dXMoXCJwYXVzZWRcIik7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcblx0XG5cdHRvZ2dsZUNvbmZpcm1SZW1vdmUoaXRlbTogYW55LCBldmVudDogRXZlbnQpOiB2b2lkIHtcblx0XHQkKGV2ZW50LnRhcmdldCkuY2xvc2VzdChcImxpXCIpLmZpbmQoXCIuY29uZmlybS1kZWxldGVcIikudG9nZ2xlQ2xhc3MoXCJhY3RpdmVcIik7XG5cdFx0JChldmVudC50YXJnZXQpLmNsb3Nlc3QoXCJsaVwiKS5maW5kKFwiLnRhc2stc3RhdHVzXCIpLnRvZ2dsZUNsYXNzKFwiZmFkZWRcIik7XG5cdH07XG5cdFxuXHRyZW1vdmUoKTogdm9pZCB7XG5cdFx0aWYoIXRoaXMucmVtb3ZlZCgpKSB7XG5cdFx0XHR0aGlzLnJlbW92ZWQodHJ1ZSk7XG5cdFx0XHRnZXRCYWNrZ3JvdW5kUGFnZSgpLmRlbGV0ZVRhc2sodGhpcy5pZCgpLCAoc3VjY2VzczogYm9vbGVhbiwgZGF0YTogYW55KSA9PiB7XG5cdFx0XHRcdHRoaXMucmVtb3ZlZChzdWNjZXNzKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcbn0iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=

package com.studyforge.interaction.mapper;

import com.studyforge.interaction.entity.Comment;
import java.util.List;
import org.apache.ibatis.annotations.Param;

public interface CommentMapper {
    Comment selectById(@Param("commentId") Long commentId);

    List<Comment> selectVisibleByPostId(@Param("postId") Long postId);

    int insert(Comment comment);
}
